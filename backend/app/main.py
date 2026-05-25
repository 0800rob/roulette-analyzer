from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session as DBSession
from collections import Counter
from datetime import datetime, timedelta
import asyncio
import json
import os

from .database import engine, get_db, Base, apply_lightweight_migrations
from .models import Session, Spin, StrategyAlert, TrackedTrigger, User
from .schemas import (
    SessionCreate, SessionResponse, SpinCreate, SpinResponse,
    NumberFrequency, ColorStats, ParityStats, DozenStats,
    HotColdNumbers, SessionStats,
    PredictionItem, PredictionResponse,
    GroupStrategyResponse, MonitorStrategyResponse,
    LiveTableInfo, SetLiveRequest, StrategyAlertResponse,
    ChaseStatus, ChaseStatusResponse,
    ChaseHistoryItem, ChaseHistoryResponse,
    RegisterRequest, LoginRequest, TokenResponse, UserResponse,
    GrantLicenseRequest, AdminUserListItem,
)
from .roulette_utils import get_color, get_dozen, calculate_longest_streak
from .prediction_engine import (
    compute_predictions,
    compute_group_strategy,
    compute_monitor_strategy,
    MIN_SPINS_REQUIRED,
)
from .scraper import SUPPORTED_TABLES
from .live_scheduler import run_scheduler
from .auth import (
    hash_password, verify_password, create_access_token,
    get_current_user, require_license, require_admin,
)

# Create tables and apply lightweight migrations for existing DBs.
Base.metadata.create_all(bind=engine)
apply_lightweight_migrations()

app = FastAPI(title="Roulette Analyzer API", version="1.0.0")

# CORS — origins are configurable via environment for production deployments.
# In dev, defaults to the Vite dev server. In production, set CORS_ORIGINS to
# a comma-separated list (e.g. "https://my-app.vercel.app,https://my-domain.com").
_default_origins = "http://localhost:5173,http://localhost:3000"
_cors_origins = [
    o.strip() for o in os.getenv("CORS_ORIGINS", _default_origins).split(",") if o.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============ HELPERS ============

def _get_user_session(session_id: int, user: User, db: DBSession) -> Session:
    """Fetch a session and ensure it belongs to the current user.

    Admins can access any session. Returns 404 if the session is missing or
    not owned by the caller.
    """
    q = db.query(Session).filter(Session.id == session_id)
    if not user.is_admin:
        q = q.filter(Session.user_id == user.id)
    sess = q.first()
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    return sess


# ============ AUTH ============

@app.post("/api/auth/register", response_model=TokenResponse)
def register(data: RegisterRequest, db: DBSession = Depends(get_db)):
    """Create a new user. By default, no license days are granted — admins
    must extend it manually or the user must purchase a plan."""
    email = data.email.strip().lower()
    if "@" not in email or len(email) < 5:
        raise HTTPException(status_code=400, detail="Email inválido")

    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email já cadastrado")

    # If this is the very first user, make them admin automatically — useful
    # for bootstrapping the app on a fresh install.
    user_count = db.query(User).count()
    is_first = user_count == 0

    user = User(
        email=email,
        password_hash=hash_password(data.password),
        is_active=True,
        is_admin=is_first,
        # First user gets unlimited; others start with no license (must pay).
        expires_at=None if not is_first else datetime.utcnow() + timedelta(days=365 * 10),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # If this is the first (admin) user, claim any orphaned sessions created
    # before auth existed so the legacy data doesn't get hidden.
    if is_first:
        db.query(Session).filter(Session.user_id.is_(None)).update(
            {Session.user_id: user.id}
        )
        db.commit()

    return TokenResponse(access_token=create_access_token(user.id))


@app.post("/api/auth/login", response_model=TokenResponse)
def login(data: LoginRequest, db: DBSession = Depends(get_db)):
    email = data.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Credenciais inválidas")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Conta desativada")
    return TokenResponse(access_token=create_access_token(user.id))


@app.get("/api/auth/me", response_model=UserResponse)
def whoami(user: User = Depends(get_current_user)):
    return user


# ============ ADMIN ============

@app.get("/api/admin/users", response_model=list[AdminUserListItem])
def admin_list_users(
    _: User = Depends(require_admin),
    db: DBSession = Depends(get_db),
):
    users = db.query(User).order_by(User.created_at.desc()).all()
    out: list[AdminUserListItem] = []
    for u in users:
        out.append(AdminUserListItem(
            id=u.id,
            email=u.email,
            is_active=u.is_active,
            is_admin=u.is_admin,
            expires_at=u.expires_at,
            created_at=u.created_at,
            session_count=len(u.sessions),
        ))
    return out


@app.post("/api/admin/users/{user_id}/grant", response_model=AdminUserListItem)
def admin_grant_license(
    user_id: int,
    payload: GrantLicenseRequest,
    _: User = Depends(require_admin),
    db: DBSession = Depends(get_db),
):
    """Add (or remove with negative `days`) days to a user's license."""
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    base = target.expires_at if (target.expires_at and target.expires_at > datetime.utcnow()) else datetime.utcnow()
    target.expires_at = base + timedelta(days=payload.days)
    db.commit()
    db.refresh(target)
    return AdminUserListItem(
        id=target.id,
        email=target.email,
        is_active=target.is_active,
        is_admin=target.is_admin,
        expires_at=target.expires_at,
        created_at=target.created_at,
        session_count=len(target.sessions),
    )


@app.post("/api/admin/users/{user_id}/active", response_model=AdminUserListItem)
def admin_set_active(
    user_id: int,
    is_active: bool,
    _: User = Depends(require_admin),
    db: DBSession = Depends(get_db),
):
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    target.is_active = is_active
    db.commit()
    db.refresh(target)
    return AdminUserListItem(
        id=target.id,
        email=target.email,
        is_active=target.is_active,
        is_admin=target.is_admin,
        expires_at=target.expires_at,
        created_at=target.created_at,
        session_count=len(target.sessions),
    )




@app.get("/api/sessions", response_model=list[SessionResponse])
def list_sessions(
    user: User = Depends(require_license),
    db: DBSession = Depends(get_db),
):
    q = db.query(Session)
    if not user.is_admin:
        q = q.filter(Session.user_id == user.id)
    sessions = q.order_by(Session.created_at.desc()).all()
    result = []
    for s in sessions:
        result.append(SessionResponse(
            id=s.id,
            name=s.name,
            casino=s.casino,
            created_at=s.created_at,
            spin_count=len(s.spins),
            live_table=s.live_table,
        ))
    return result


@app.post("/api/sessions", response_model=SessionResponse)
def create_session(
    data: SessionCreate,
    user: User = Depends(require_license),
    db: DBSession = Depends(get_db),
):
    session = Session(name=data.name, casino=data.casino, user_id=user.id)
    db.add(session)
    db.commit()
    db.refresh(session)
    return SessionResponse(
        id=session.id,
        name=session.name,
        casino=session.casino,
        created_at=session.created_at,
        spin_count=0,
        live_table=session.live_table,
    )


@app.delete("/api/sessions/{session_id}")
def delete_session(
    session_id: int,
    user: User = Depends(require_license),
    db: DBSession = Depends(get_db),
):
    session = _get_user_session(session_id, user, db)
    db.delete(session)
    db.commit()
    return {"message": "Session deleted"}


# ============ SPINS ============

@app.get("/api/sessions/{session_id}/spins", response_model=list[SpinResponse])
def list_spins(
    session_id: int,
    user: User = Depends(require_license),
    db: DBSession = Depends(get_db),
):
    session = _get_user_session(session_id, user, db)
    return session.spins


@app.post("/api/sessions/{session_id}/spins", response_model=SpinResponse)
def add_spin(
    session_id: int,
    data: SpinCreate,
    user: User = Depends(require_license),
    db: DBSession = Depends(get_db),
):
    session = _get_user_session(session_id, user, db)

    color = get_color(data.number)
    spin = Spin(session_id=session_id, number=data.number, color=color)
    db.add(spin)
    db.commit()
    db.refresh(spin)
    return spin


@app.delete("/api/sessions/{session_id}/spins/last")
def undo_last_spin(
    session_id: int,
    user: User = Depends(require_license),
    db: DBSession = Depends(get_db),
):
    _get_user_session(session_id, user, db)
    spin = (
        db.query(Spin)
        .filter(Spin.session_id == session_id)
        .order_by(Spin.created_at.desc())
        .first()
    )
    if not spin:
        raise HTTPException(status_code=404, detail="No spins to undo")
    db.delete(spin)
    db.commit()
    return {"message": "Last spin removed"}


# ============ STATISTICS ============

@app.get("/api/sessions/{session_id}/stats", response_model=SessionStats)
def get_stats(
    session_id: int,
    user: User = Depends(require_license),
    db: DBSession = Depends(get_db),
):
    session = _get_user_session(session_id, user, db)

    spins = (
        db.query(Spin)
        .filter(Spin.session_id == session_id)
        .order_by(Spin.created_at.asc())
        .all()
    )
    total = len(spins)

    if total == 0:
        return SessionStats(
            total_spins=0,
            frequencies=[],
            colors=ColorStats(red=0, black=0, green=0, red_pct=0, black_pct=0, green_pct=0),
            parity=ParityStats(even=0, odd=0, zero=0, even_pct=0, odd_pct=0),
            dozens=DozenStats(first=0, second=0, third=0, zero=0),
            hot_cold=HotColdNumbers(hot=[], cold=[]),
            last_10=[],
            longest_streak={"type": "", "value": "", "length": 0},
        )

    # Frequency count
    counter = Counter(s.number for s in spins)
    frequencies = []
    for num in range(37):
        count = counter.get(num, 0)
        frequencies.append(NumberFrequency(
            number=num,
            color=get_color(num),
            count=count,
            percentage=round((count / total) * 100, 2),
        ))

    # Color stats
    colors_count = Counter(s.color for s in spins)
    colors = ColorStats(
        red=colors_count.get("red", 0),
        black=colors_count.get("black", 0),
        green=colors_count.get("green", 0),
        red_pct=round((colors_count.get("red", 0) / total) * 100, 2),
        black_pct=round((colors_count.get("black", 0) / total) * 100, 2),
        green_pct=round((colors_count.get("green", 0) / total) * 100, 2),
    )

    # Parity
    even = sum(1 for s in spins if s.number != 0 and s.number % 2 == 0)
    odd = sum(1 for s in spins if s.number % 2 == 1)
    zero = sum(1 for s in spins if s.number == 0)
    non_zero = total - zero
    parity = ParityStats(
        even=even, odd=odd, zero=zero,
        even_pct=round((even / non_zero) * 100, 2) if non_zero else 0,
        odd_pct=round((odd / non_zero) * 100, 2) if non_zero else 0,
    )

    # Dozens
    dozen_count = Counter(get_dozen(s.number) for s in spins)
    dozens = DozenStats(
        first=dozen_count.get("first", 0),
        second=dozen_count.get("second", 0),
        third=dozen_count.get("third", 0),
        zero=dozen_count.get("zero", 0),
    )

    # Hot/Cold
    sorted_freq = sorted(frequencies, key=lambda x: x.count, reverse=True)
    non_zero_freq = [f for f in sorted_freq if f.number != 0]
    hot = non_zero_freq[:5]
    cold = list(reversed(non_zero_freq[-5:]))

    # Last 10
    last_10 = spins[-10:]

    # Longest streak
    longest_streak = calculate_longest_streak(spins)

    return SessionStats(
        total_spins=total,
        frequencies=frequencies,
        colors=colors,
        parity=parity,
        dozens=dozens,
        hot_cold=HotColdNumbers(hot=hot, cold=cold),
        last_10=last_10,
        longest_streak=longest_streak,
    )


# ============ PREDICTIONS ============

@app.get("/api/sessions/{session_id}/predictions", response_model=PredictionResponse)
def get_predictions(
    session_id: int,
    user: User = Depends(require_license),
    db: DBSession = Depends(get_db),
):
    """Returns predictions for a session based on spin history."""
    session = _get_user_session(session_id, user, db)

    spins = (
        db.query(Spin)
        .filter(Spin.session_id == session_id)
        .order_by(Spin.created_at.asc())
        .all()
    )

    total_spins = len(spins)
    spin_numbers = [s.number for s in spins]

    # Cap analysis window to last 50 spins for performance
    analysis_window = min(total_spins, 50)
    analysis_spins = spin_numbers[-analysis_window:] if total_spins > 50 else spin_numbers

    # Compute predictions (returns empty list if < MIN_SPINS_REQUIRED)
    raw_predictions = compute_predictions(analysis_spins)

    predictions = [
        PredictionItem(
            number=p["number"],
            color=p["color"],
            confidence_score=p["confidence_score"],
            reasons=p["reasons"],
        )
        for p in raw_predictions
    ]

    return PredictionResponse(
        predictions=predictions,
        analysis_window=analysis_window,
        min_spins_required=MIN_SPINS_REQUIRED,
        total_spins=total_spins,
    )



# ============ GROUP STRATEGY ============

@app.get("/api/sessions/{session_id}/group-strategy", response_model=GroupStrategyResponse)
def get_group_strategy(
    session_id: int,
    window: int = 7,
    neighbours: int = 1,
    user: User = Depends(require_license),
    db: DBSession = Depends(get_db),
):
    """Apply the user's custom group-based strategy to the session history.

    Returns a triggered play (3 hit numbers + race neighbours) when 3 spins
    from the same group (1-9, 10-19, 20-29, 30-36) appear within the last
    `window` spins and the digital-root sum is in [1, 33].
    """
    session = _get_user_session(session_id, user, db)

    spins = (
        db.query(Spin)
        .filter(Spin.session_id == session_id)
        .order_by(Spin.created_at.asc())
        .all()
    )
    spin_numbers = [s.number for s in spins]

    result = compute_group_strategy(spin_numbers, window=window, neighbours=neighbours)

    if result is None:
        return GroupStrategyResponse(triggered=False, window=window)

    # Pydantic dict keys must be strings
    neighbours_str = {str(k): v for k, v in result["neighbours"].items()}

    return GroupStrategyResponse(
        triggered=True,
        group=result["group"],
        group_label=result["group_label"],
        triple=result["triple"],
        digital_roots=result["digital_roots"],
        sum=result["sum"],
        hit_numbers=result["hit_numbers"],
        neighbours=neighbours_str,
        all_marked=result["all_marked"],
        window=result["window"],
    )



# ============ MONITOR STRATEGY (STR 2) ============

@app.get("/api/sessions/{session_id}/monitor-strategy", response_model=MonitorStrategyResponse)
def get_monitor_strategy(
    session_id: int,
    user: User = Depends(require_license),
    db: DBSession = Depends(get_db),
):
    """STR 2 — monitor numbers based on the last two spins.

    Computes calc1=(prev+last)%36, calc2=|prev-last|, calc3=36-calc2 and
    returns the union of the associated numbers for those three keys.
    """
    session = _get_user_session(session_id, user, db)

    spins = (
        db.query(Spin)
        .filter(Spin.session_id == session_id)
        .order_by(Spin.created_at.asc())
        .all()
    )
    spin_numbers = [s.number for s in spins]

    result = compute_monitor_strategy(spin_numbers)
    if result is None:
        return MonitorStrategyResponse(triggered=False)

    return MonitorStrategyResponse(
        triggered=result["triggered"],
        awaiting_next=result.get("awaiting_next", False),
        pair=result.get("pair", []),
        current=result.get("current"),
        second=result.get("second"),
        calc1=result.get("calc1"),
        calc2=result.get("calc2"),
        calc3=result.get("calc3"),
        associations=result.get("associations", {}),
        monitored=result.get("monitored", []),
    )



# ============ LIVE SESSIONS ============

@app.on_event("startup")
async def _start_scheduler() -> None:
    """Kick off the background poller that feeds live sessions."""
    asyncio.create_task(run_scheduler())


@app.get("/api/live/tables", response_model=list[LiveTableInfo])
def list_live_tables():
    """Tables supported by the live-scraper."""
    return [
        LiveTableInfo(key=k, label=v["label"])
        for k, v in SUPPORTED_TABLES.items()
    ]


@app.post("/api/sessions/{session_id}/live", response_model=SessionResponse)
def set_session_live(
    session_id: int,
    payload: SetLiveRequest,
    user: User = Depends(require_license),
    db: DBSession = Depends(get_db),
):
    """Enable / disable live-feed mode for a session.

    Pass {"table": "auto-roulette"} to enable, or {"table": null} to disable.
    """
    session = _get_user_session(session_id, user, db)

    if payload.table is not None and payload.table not in SUPPORTED_TABLES:
        raise HTTPException(status_code=400, detail=f"Unsupported table {payload.table!r}")

    session.live_table = payload.table
    db.commit()
    db.refresh(session)
    return SessionResponse(
        id=session.id,
        name=session.name,
        casino=session.casino,
        created_at=session.created_at,
        spin_count=len(session.spins),
        live_table=session.live_table,
    )


@app.get(
    "/api/sessions/{session_id}/alerts",
    response_model=list[StrategyAlertResponse],
)
def list_alerts(
    session_id: int,
    limit: int = 50,
    user: User = Depends(require_license),
    db: DBSession = Depends(get_db),
):
    """List historical strategy alerts for a session, newest first."""
    session = _get_user_session(session_id, user, db)

    rows = (
        db.query(StrategyAlert)
        .filter(StrategyAlert.session_id == session_id)
        .order_by(StrategyAlert.created_at.desc())
        .limit(limit)
        .all()
    )

    out: list[StrategyAlertResponse] = []
    for row in rows:
        # Look up the spin number for the round
        spin = db.query(Spin).filter(Spin.id == row.spin_id).first() if row.spin_id else None
        try:
            payload = json.loads(row.payload)
        except Exception:
            payload = {}
        out.append(StrategyAlertResponse(
            id=row.id,
            strategy=row.strategy,
            created_at=row.created_at,
            spin_id=row.spin_id,
            spin_number=spin.number if spin else None,
            payload=payload,
        ))
    return out



# ============ CHASE STATUS (active triggers being followed) ============

# How many seconds we keep showing "ALVO ATINGIDO" before the slot becomes
# truly idle on the frontend.
_RESOLVED_DISPLAY_WINDOW_SECONDS = 8


def _chase_to_status(strategy: str, chase: TrackedTrigger | None, db: DBSession) -> ChaseStatus:
    """Convert a TrackedTrigger row (or None) into the API response shape."""
    if chase is None:
        return ChaseStatus(strategy=strategy, status="idle")

    payload: dict = {}
    try:
        payload = json.loads(chase.payload) if chase.payload else {}
    except Exception:
        payload = {}

    marked = [int(n) for n in payload.get("marked_numbers", [])]
    # hit_numbers is the strategy's "primary targets" (3 cheios on STR1, etc).
    if strategy == "str1":
        hits = [int(n) for n in payload.get("hit_numbers", [])]
    else:
        hits = marked  # STR2 has no notion of "hit vs neighbour"

    started_spin = (
        db.query(Spin).filter(Spin.id == chase.started_spin_id).first()
        if chase.started_spin_id
        else None
    )

    return ChaseStatus(
        strategy=strategy,
        status=chase.status,
        started_at=chase.started_at,
        resolved_at=chase.resolved_at,
        spins_followed=chase.spins_followed or 0,
        started_spin_number=started_spin.number if started_spin else None,
        resolved_spin_number=chase.resolved_number,
        marked_numbers=marked,
        hit_numbers=hits,
        snapshot=payload,
    )


def _current_chase(
    db: DBSession, session_id: int, strategy: str
) -> TrackedTrigger | None:
    """Pick the chase to show for a strategy.

    Priority:
      1. The currently-active chase (status='active'), if any.
      2. The most-recently-resolved chase from the last few seconds, so the
         UI can briefly show the "ALVO ATINGIDO" celebration before going
         back to idle.
    """
    active = (
        db.query(TrackedTrigger)
        .filter(
            TrackedTrigger.session_id == session_id,
            TrackedTrigger.strategy == strategy,
            TrackedTrigger.status == "active",
        )
        .order_by(TrackedTrigger.started_at.desc())
        .first()
    )
    if active:
        return active

    cutoff = datetime.utcnow() - timedelta(seconds=_RESOLVED_DISPLAY_WINDOW_SECONDS)
    recent_resolved = (
        db.query(TrackedTrigger)
        .filter(
            TrackedTrigger.session_id == session_id,
            TrackedTrigger.strategy == strategy,
            TrackedTrigger.status == "resolved",
            TrackedTrigger.resolved_at >= cutoff,
        )
        .order_by(TrackedTrigger.resolved_at.desc())
        .first()
    )
    return recent_resolved


@app.get("/api/sessions/{session_id}/chase", response_model=ChaseStatusResponse)
def get_chase_status(
    session_id: int,
    user: User = Depends(require_license),
    db: DBSession = Depends(get_db),
):
    """Current state of the chase tracker for a session."""
    session = _get_user_session(session_id, user, db)

    str1_chase = _current_chase(db, session_id, "str1")
    str2_chase = _current_chase(db, session_id, "str2")
    return ChaseStatusResponse(
        str1=_chase_to_status("str1", str1_chase, db),
        str2=_chase_to_status("str2", str2_chase, db),
    )



@app.get(
    "/api/sessions/{session_id}/chase/history",
    response_model=ChaseHistoryResponse,
)
def get_chase_history(
    session_id: int,
    limit: int = 30,
    user: User = Depends(require_license),
    db: DBSession = Depends(get_db),
):
    """Historical list of chases (resolved + active), newest first.

    Also returns per-strategy hit-rate summary.
    """
    session = _get_user_session(session_id, user, db)

    rows = (
        db.query(TrackedTrigger)
        .filter(TrackedTrigger.session_id == session_id)
        .order_by(TrackedTrigger.started_at.desc())
        .limit(limit)
        .all()
    )

    items: list[ChaseHistoryItem] = []
    summary: dict[str, dict] = {
        "str1": {"greens": 0, "avg_spins_to_green": 0.0},
        "str2": {"greens": 0, "avg_spins_to_green": 0.0},
    }
    sums: dict[str, list[int]] = {"str1": [], "str2": []}

    for row in rows:
        try:
            payload = json.loads(row.payload) if row.payload else {}
        except Exception:
            payload = {}

        marked = [int(n) for n in payload.get("marked_numbers", [])]
        if row.strategy == "str1":
            hits = [int(n) for n in payload.get("hit_numbers", [])]
        else:
            hits = marked

        started_spin = (
            db.query(Spin).filter(Spin.id == row.started_spin_id).first()
            if row.started_spin_id
            else None
        )

        items.append(ChaseHistoryItem(
            id=row.id,
            strategy=row.strategy,
            status=row.status,
            started_at=row.started_at,
            resolved_at=row.resolved_at,
            spins_followed=row.spins_followed or 0,
            started_spin_number=started_spin.number if started_spin else None,
            resolved_spin_number=row.resolved_number,
            marked_numbers=marked,
            hit_numbers=hits,
        ))

        if row.strategy in summary and row.status == "resolved":
            summary[row.strategy]["greens"] += 1
            sums[row.strategy].append(row.spins_followed or 0)

    for k in summary:
        n = len(sums[k])
        summary[k]["avg_spins_to_green"] = (
            round(sum(sums[k]) / n, 2) if n else 0.0
        )

    return ChaseHistoryResponse(items=items, summary=summary)
