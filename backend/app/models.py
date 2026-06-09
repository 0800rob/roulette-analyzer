from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime

from .database import Base


class User(Base):
    """An account that owns sessions and has a license expiry date."""

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    is_admin = Column(Boolean, nullable=False, default=False)
    # When None, the user has no license. Otherwise, license is valid while
    # `expires_at > now()`. Admin users bypass this check.
    expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    sessions = relationship("Session", back_populates="user", cascade="all, delete-orphan")


class Session(Base):
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    casino = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    # When set (e.g. "auto-roulette"), the session is fed automatically by the
    # scraper instead of accepting manual spin inputs.
    live_table = Column(String, nullable=True)
    # Owner — null for legacy sessions created before auth was added.
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    # PnL simulation settings (per session)
    # chip_value: monetary value of one chip placed on a single number.
    # max_chase_spins: how many spins to follow a chase before giving up
    # (NULL means follow forever).
    chip_value = Column(Integer, nullable=False, default=1)
    max_chase_spins = Column(Integer, nullable=True)

    spins = relationship("Spin", back_populates="session", cascade="all, delete-orphan")
    user = relationship("User", back_populates="sessions")


class Spin(Base):
    __tablename__ = "spins"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=False)
    number = Column(Integer, nullable=False)  # 0-36
    color = Column(String, nullable=False)  # red, black, green
    created_at = Column(DateTime, default=datetime.utcnow)
    # External event ID from the live source (used for deduplication when the
    # scraper polls and we want to avoid inserting the same spin twice).
    external_id = Column(String, nullable=True, index=True)

    session = relationship("Session", back_populates="spins")


class StrategyAlert(Base):
    """A historical record of a strategy trigger that fired on a given spin.

    Lets us answer "which round did STR 1 / STR 2 fire on?" later.
    """

    __tablename__ = "strategy_alerts"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=False)
    spin_id = Column(Integer, ForeignKey("spins.id"), nullable=True)
    strategy = Column(String, nullable=False)  # 'str1'
    payload = Column(String, nullable=False)   # JSON snapshot of the trigger
    created_at = Column(DateTime, default=datetime.utcnow)


class TrackedTrigger(Base):
    """A "chase" — the currently-tracked trigger for a given strategy.

    The user wants to follow ONE trigger per strategy at a time. When a new
    trigger fires while no chase is active, we open a chase. Each subsequent
    spin is checked against the chase's `marked_numbers` — when it lands, we
    mark the chase RESOLVED.

    Statuses:
        active   — currently being followed
        resolved — last spin landed on a marked number ("ALVO ATINGIDO")
        lost     — chased for `max_chase_spins` without hitting; gave up
    """

    __tablename__ = "tracked_triggers"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=False)
    strategy = Column(String, nullable=False)            # 'str1'
    status = Column(String, nullable=False, default="active")
    started_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)
    # Spin that originally produced the trigger
    started_spin_id = Column(Integer, ForeignKey("spins.id"), nullable=True)
    # Spin where the chase landed (if resolved)
    resolved_spin_id = Column(Integer, ForeignKey("spins.id"), nullable=True)
    # Number that was rolled on the resolving spin (denormalised for display)
    resolved_number = Column(Integer, nullable=True)
    # JSON-encoded snapshot of the trigger payload + the marked numbers list
    payload = Column(String, nullable=False)
    # Number of spins that have happened since the trigger was opened
    spins_followed = Column(Integer, nullable=False, default=0)
