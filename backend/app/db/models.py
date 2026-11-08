from datetime import datetime
from uuid import UUID

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Double,
    ForeignKey,
    Index,
    Integer,
    String,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.types import UtcDateTime


class RecordingSession(Base):
    __tablename__ = "sessions"
    __table_args__ = (Index("ix_sessions_started_at", "started_at"),)

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    started_at: Mapped[datetime] = mapped_column(UtcDateTime, nullable=False)
    ended_at: Mapped[datetime | None] = mapped_column(UtcDateTime)
    idempotency_key: Mapped[UUID | None] = mapped_column(Uuid, unique=True)
    samples_produced: Mapped[int | None] = mapped_column(Integer)


class Sample(Base):
    __tablename__ = "samples"
    __table_args__ = (
        CheckConstraint("t >= 0", name="ck_samples_t"),
        CheckConstraint("fps >= 0 AND fps <= 120", name="ck_samples_fps"),
        CheckConstraint("brightness >= 0 AND brightness <= 255", name="ck_samples_brightness"),
        CheckConstraint("motion >= 0 AND motion <= 255", name="ck_samples_motion"),
        CheckConstraint(
            "(verdict = 'good' AND reason IS NULL) OR "
            "(verdict = 'poor' AND reason IN "
            "('no_face', 'too_dark', 'too_bright', 'hold_still', 'low_fps'))",
            name="ck_samples_verdict_reason",
        ),
    )

    session_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("sessions.id", ondelete="CASCADE"), primary_key=True
    )
    t: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)
    fps: Mapped[float] = mapped_column(Double, nullable=False)
    brightness: Mapped[float] = mapped_column(Double, nullable=False)
    motion: Mapped[float] = mapped_column(Double, nullable=False)
    face: Mapped[bool] = mapped_column(Boolean, nullable=False)
    verdict: Mapped[str] = mapped_column(String(8), nullable=False)
    reason: Mapped[str | None] = mapped_column(String(16))


class RateLimitCounter(Base):
    __tablename__ = "rate_limit_counters"

    bucket: Mapped[str] = mapped_column(String(16), primary_key=True)
    client_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    window_start: Mapped[int] = mapped_column(BigInteger, nullable=False)
    hits: Mapped[int] = mapped_column(Integer, nullable=False)
