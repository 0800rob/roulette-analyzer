from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


# --- Session ---
class SessionCreate(BaseModel):
    name: str
    casino: Optional[str] = None


class SessionResponse(BaseModel):
    id: int
    name: str
    casino: Optional[str]
    created_at: datetime
    spin_count: int = 0
    live_table: Optional[str] = None

    class Config:
        from_attributes = True


# --- Spin ---
class SpinCreate(BaseModel):
    number: int = Field(ge=0, le=36)


class SpinResponse(BaseModel):
    id: int
    session_id: int
    number: int
    color: str
    created_at: datetime

    class Config:
        from_attributes = True


# --- Statistics ---
class NumberFrequency(BaseModel):
    number: int
    color: str
    count: int
    percentage: float


class ColorStats(BaseModel):
    red: int
    black: int
    green: int
    red_pct: float
    black_pct: float
    green_pct: float


class ParityStats(BaseModel):
    even: int
    odd: int
    zero: int
    even_pct: float
    odd_pct: float


class DozenStats(BaseModel):
    first: int  # 1-12
    second: int  # 13-24
    third: int  # 25-36
    zero: int


class HotColdNumbers(BaseModel):
    hot: list[NumberFrequency]  # top 5 most frequent
    cold: list[NumberFrequency]  # top 5 least frequent


class SessionStats(BaseModel):
    total_spins: int
    frequencies: list[NumberFrequency]
    colors: ColorStats
    parity: ParityStats
    dozens: DozenStats
    hot_cold: HotColdNumbers
    last_10: list[SpinResponse]
    longest_streak: dict


# --- Predictions ---
class PredictionItem(BaseModel):
    number: int
    color: str
    confidence_score: float = Field(ge=0.0, le=1.0)
    reasons: list[str]


class PredictionResponse(BaseModel):
    predictions: list[PredictionItem]
    analysis_window: int
    min_spins_required: int = 10
    total_spins: int



# --- Group Strategy ---
class GroupStrategyResponse(BaseModel):
    triggered: bool
    group: int | None = None
    group_label: str | None = None
    triple: list[int] = []
    digital_roots: list[int] = []
    sum: int | None = None
    hit_numbers: list[int] = []
    neighbours: dict[str, list[int]] = {}
    all_marked: list[int] = []
    window: int



# --- Monitor Strategy (STR 2) ---
class MonitorStrategyResponse(BaseModel):
    triggered: bool
    awaiting_next: bool = False
    pair: list[int] = []
    current: int | None = None
    second: int | None = None
    calc1: int | None = None
    calc2: int | None = None
    calc3: int | None = None
    associations: dict[str, list[int]] = {}
    monitored: list[int] = []



# --- Live tables / scraper integration ---
class LiveTableInfo(BaseModel):
    key: str
    label: str


class SetLiveRequest(BaseModel):
    table: str | None  # None disables live mode


class StrategyAlertResponse(BaseModel):
    id: int
    strategy: str
    created_at: datetime
    spin_id: int | None = None
    spin_number: int | None = None
    payload: dict



# --- Chase tracker (1 active trigger per strategy) ---
class ChaseStatus(BaseModel):
    """Status of one strategy's tracked trigger."""
    strategy: str
    status: str  # 'idle' | 'active' | 'just_resolved'
    started_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    spins_followed: int = 0
    started_spin_number: Optional[int] = None
    resolved_spin_number: Optional[int] = None
    marked_numbers: list[int] = []
    hit_numbers: list[int] = []
    snapshot: dict = {}


class ChaseStatusResponse(BaseModel):
    str1: ChaseStatus
    str2: ChaseStatus



# --- Chase history (resolved/expired triggers, for the log) ---
class ChaseHistoryItem(BaseModel):
    id: int
    strategy: str                # 'str1' | 'str2'
    status: str                  # 'active' | 'resolved'
    started_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    spins_followed: int = 0
    started_spin_number: Optional[int] = None
    resolved_spin_number: Optional[int] = None
    marked_numbers: list[int] = []
    hit_numbers: list[int] = []


class ChaseHistoryResponse(BaseModel):
    items: list[ChaseHistoryItem]
    summary: dict        # { 'str1': {wins, total, rate}, 'str2': {...} }



# --- Auth & licenses ---
class RegisterRequest(BaseModel):
    email: str
    password: str = Field(min_length=6)


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: int
    email: str
    is_active: bool
    is_admin: bool
    expires_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class GrantLicenseRequest(BaseModel):
    days: int  # may be negative to remove time


class AdminUserListItem(BaseModel):
    id: int
    email: str
    is_active: bool
    is_admin: bool
    expires_at: Optional[datetime] = None
    created_at: datetime
    session_count: int = 0
