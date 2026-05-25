"""Background poller that feeds live sessions from the casino.org API.

For every session whose `live_table` column is set, this scheduler:
  1. Fetches the most recent spins from the upstream API.
  2. Inserts any spins we don't already have (deduplicated by external_id).
  3. After each new spin is added, runs the "chase tracker": each strategy
     (STR1, STR2) follows ONE active trigger at a time. When the new spin
     lands on a marked number, the chase resolves ("ALVO ATINGIDO"). If no
     chase is active and the strategy has a fresh trigger, a new chase opens.
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session as DBSession

from .database import SessionLocal
from .models import Session, Spin, StrategyAlert, TrackedTrigger
from .prediction_engine import (
    compute_group_strategy,
    compute_monitor_strategy,
)
from .roulette_utils import get_color
from .scraper import fetch_recent_spins, ScraperError

logger = logging.getLogger("live_scheduler")
logger.setLevel(logging.INFO)

POLL_INTERVAL_SECONDS = 10
FETCH_SIZE = 30


async def _poll_once(db: DBSession) -> None:
    """One pass over all live-enabled sessions."""
    await asyncio.to_thread(_poll_once_sync, db)


def _poll_once_sync(db: DBSession) -> None:
    live_sessions = db.query(Session).filter(Session.live_table.isnot(None)).all()
    if not live_sessions:
        return

    by_table: dict[str, list[Session]] = {}
    for s in live_sessions:
        by_table.setdefault(s.live_table, []).append(s)

    for table, sessions in by_table.items():
        try:
            spins = fetch_recent_spins(table=table, size=FETCH_SIZE)
        except ScraperError as e:
            logger.warning("Scraper failed for %s: %s", table, e)
            continue
        except Exception as e:  # pragma: no cover
            logger.exception("Unexpected scraper error for %s: %s", table, e)
            continue

        spins_oldest_first = list(reversed(spins))

        for sess in sessions:
            _ingest_session(db, sess, spins_oldest_first)


# ---------------------------------------------------------------------------
# Chase tracker
# ---------------------------------------------------------------------------

def _marked_numbers_str1(payload: dict) -> list[int]:
    """Numbers we're 'betting on' for STR1 (3 hits + neighbours)."""
    return [int(n) for n in payload.get("all_marked", [])]


def _marked_numbers_str2(payload: dict) -> list[int]:
    """Numbers we're 'betting on' for STR2 (the monitored set)."""
    return [int(n) for n in payload.get("monitored", [])]


def _process_chase(
    db: DBSession,
    sess: Session,
    strategy: str,
    new_spin: Spin,
    fresh_trigger: dict | None,
    marked_for_fresh: list[int],
) -> None:
    """Update the chase state for one strategy after a new spin arrives."""

    # Fetch the active chase, if any
    chase = (
        db.query(TrackedTrigger)
        .filter(
            TrackedTrigger.session_id == sess.id,
            TrackedTrigger.strategy == strategy,
            TrackedTrigger.status == "active",
        )
        .order_by(TrackedTrigger.started_at.desc())
        .first()
    )

    if chase is not None:
        # Increment regardless — this spin counts as "followed".
        chase.spins_followed = (chase.spins_followed or 0) + 1
        try:
            payload = json.loads(chase.payload)
        except Exception:
            payload = {}
        marked = [int(n) for n in payload.get("marked_numbers", [])]

        if new_spin.number in marked:
            # ALVO ATINGIDO 🎯
            chase.status = "resolved"
            chase.resolved_at = datetime.utcnow()
            chase.resolved_spin_id = new_spin.id
            chase.resolved_number = new_spin.number
            db.add(StrategyAlert(
                session_id=sess.id,
                spin_id=new_spin.id,
                strategy=strategy,
                payload=json.dumps({
                    "kind": "target_hit",
                    "chase_id": chase.id,
                    "number": new_spin.number,
                    "marked": marked,
                }),
            ))
        # If didn't land, just keep following — no new chase will open while
        # this one is active.
        return

    # No active chase — open one if there's a fresh trigger.
    if fresh_trigger and marked_for_fresh:
        snapshot = dict(fresh_trigger)
        snapshot["marked_numbers"] = list(marked_for_fresh)
        new_chase = TrackedTrigger(
            session_id=sess.id,
            strategy=strategy,
            status="active",
            started_at=datetime.utcnow(),
            started_spin_id=new_spin.id,
            payload=json.dumps(snapshot, default=str),
            spins_followed=0,
        )
        db.add(new_chase)
        # Also store an alert for the trigger opening
        db.add(StrategyAlert(
            session_id=sess.id,
            spin_id=new_spin.id,
            strategy=strategy,
            payload=json.dumps({
                "kind": "trigger_opened",
                "marked": marked_for_fresh,
                "snapshot": snapshot,
            }, default=str),
        ))


def _ingest_session(
    db: DBSession,
    sess: Session,
    spins_oldest_first: list[dict[str, Any]],
) -> None:
    """Insert any new spins for a session and run the chase tracker."""
    known: set[str] = {
        sid for (sid,) in db.query(Spin.external_id)
        .filter(Spin.session_id == sess.id, Spin.external_id.isnot(None))
        .all()
    }

    new_spin_objs: list[Spin] = []
    for s in spins_oldest_first:
        ext_id = s["event_id"]
        if ext_id in known:
            continue
        spin = Spin(
            session_id=sess.id,
            number=s["number"],
            color=get_color(s["number"]),
            external_id=ext_id,
        )
        try:
            spin.created_at = datetime.fromisoformat(s["settled_at"].replace("Z", "+00:00"))
        except (ValueError, TypeError):
            pass
        db.add(spin)
        new_spin_objs.append(spin)

    if not new_spin_objs:
        return

    db.flush()

    # Process each new spin in order. After every spin we re-evaluate the
    # strategies on the FULL history so chase resolution / fresh triggers
    # always reflect the latest data.
    for new_spin in new_spin_objs:
        all_numbers = [
            n for (n,) in db.query(Spin.number)
            .filter(
                Spin.session_id == sess.id,
                Spin.created_at <= new_spin.created_at,
            )
            .order_by(Spin.created_at.asc())
            .all()
        ]

        str1 = compute_group_strategy(all_numbers, window=7)
        str1_payload = str1 if (str1 and str1.get("triggered")) else None
        str1_marked = _marked_numbers_str1(str1_payload) if str1_payload else []
        _process_chase(db, sess, "str1", new_spin, str1_payload, str1_marked)

        str2 = compute_monitor_strategy(all_numbers)
        str2_payload = str2 if (str2 and str2.get("triggered")) else None
        str2_marked = _marked_numbers_str2(str2_payload) if str2_payload else []
        _process_chase(db, sess, "str2", new_spin, str2_payload, str2_marked)

    db.commit()
    logger.info(
        "Session %s: ingested %d new spins (last=%d)",
        sess.id, len(new_spin_objs), new_spin_objs[-1].number,
    )


async def run_scheduler() -> None:
    """Forever loop: poll → sleep → repeat."""
    logger.info("Live scheduler starting (interval=%ss)", POLL_INTERVAL_SECONDS)
    while True:
        try:
            db = SessionLocal()
            try:
                await _poll_once(db)
            finally:
                db.close()
        except Exception as e:  # pragma: no cover
            logger.exception("Poll loop error: %s", e)
        await asyncio.sleep(POLL_INTERVAL_SECONDS)
