import os

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase

# Database URL is read from the DATABASE_URL env var (set by Fly.io / Render /
# Railway / Supabase to a postgres:// URL). In dev, falls back to a local
# SQLite file so the project still runs without configuration.
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./roulette.db")

# Some hosting providers prefix Postgres URLs with "postgres://" but SQLAlchemy
# 2.x expects "postgresql://". Auto-fix it so the user doesn't have to care.
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# `check_same_thread` is a SQLite-specific quirk; for Postgres we don't pass it.
_engine_kwargs = {}
if DATABASE_URL.startswith("sqlite"):
    _engine_kwargs["connect_args"] = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, **_engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def apply_lightweight_migrations() -> None:
    """Adds columns introduced after the original schema to existing SQLite DBs.

    Only runs on SQLite — Postgres deployments start fresh and SQLAlchemy's
    `create_all()` already creates every table/column from `models.py`.

    SQLAlchemy doesn't auto-add new columns to existing tables, so we apply
    the deltas manually via ALTER TABLE. Each statement is wrapped in a
    try/except so it's safe to run repeatedly (already-applied migrations
    just raise OperationalError, which we ignore).
    """
    if not DATABASE_URL.startswith("sqlite"):
        return

    statements = [
        # Session.live_table
        "ALTER TABLE sessions ADD COLUMN live_table VARCHAR",
        # Spin.external_id
        "ALTER TABLE spins ADD COLUMN external_id VARCHAR",
        "CREATE INDEX IF NOT EXISTS ix_spins_external_id ON spins(external_id)",
        # tracked_triggers table
        """CREATE TABLE IF NOT EXISTS tracked_triggers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL,
            strategy VARCHAR NOT NULL,
            status VARCHAR NOT NULL DEFAULT 'active',
            started_at DATETIME,
            resolved_at DATETIME,
            started_spin_id INTEGER,
            resolved_spin_id INTEGER,
            resolved_number INTEGER,
            payload TEXT NOT NULL,
            spins_followed INTEGER NOT NULL DEFAULT 0
        )""",
        "CREATE INDEX IF NOT EXISTS ix_tracked_triggers_session ON tracked_triggers(session_id, strategy, status)",
        # users table (auth + license)
        """CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email VARCHAR NOT NULL UNIQUE,
            password_hash VARCHAR NOT NULL,
            is_active INTEGER NOT NULL DEFAULT 1,
            is_admin INTEGER NOT NULL DEFAULT 0,
            expires_at DATETIME,
            created_at DATETIME
        )""",
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_email ON users(email)",
        # sessions.user_id (added when auth was introduced)
        "ALTER TABLE sessions ADD COLUMN user_id INTEGER",
        "CREATE INDEX IF NOT EXISTS ix_sessions_user_id ON sessions(user_id)",
        # sessions PnL settings (added with the chase-tracker simulation)
        "ALTER TABLE sessions ADD COLUMN chip_value INTEGER NOT NULL DEFAULT 1",
        "ALTER TABLE sessions ADD COLUMN max_chase_spins INTEGER",
    ]
    with engine.begin() as conn:
        for sql in statements:
            try:
                conn.execute(text(sql))
            except Exception:
                pass
