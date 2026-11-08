from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Integer, Select, case, func, literal, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.db.models import RecordingSession, Sample
from app.db.types import UtcDateTime


@dataclass(frozen=True)
class SessionStats:
    session: RecordingSession
    samples_saved: int
    last_t: int
    average_fps: float | None
    face_seconds: int
    good_seconds: int


class SessionRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def create(
        self, started_at: datetime, idempotency_key: UUID | None
    ) -> tuple[RecordingSession, bool]:
        if idempotency_key is None:
            session = RecordingSession(id=uuid4(), started_at=started_at)
            self._db.add(session)
            self._db.flush()

            return session, True

        statement = (
            insert(RecordingSession)
            .values(id=uuid4(), started_at=started_at, idempotency_key=idempotency_key)
            .on_conflict_do_nothing(index_elements=["idempotency_key"])
            .returning(RecordingSession.id)
        )

        created = self._db.execute(statement).first() is not None

        session = self._db.scalars(
            select(RecordingSession).where(RecordingSession.idempotency_key == idempotency_key)
        ).one()

        return session, created

    def get(self, session_id: UUID) -> RecordingSession | None:
        return self._db.get(RecordingSession, session_id)

    def mark_stopped(
        self, session_id: UUID, ended_at: datetime, samples_produced: int | None
    ) -> bool:
        statement = (
            update(RecordingSession)
            .where(RecordingSession.id == session_id)
            .values(
                ended_at=func.coalesce(RecordingSession.ended_at, literal(ended_at, UtcDateTime())),
                samples_produced=func.coalesce(
                    RecordingSession.samples_produced, literal(samples_produced, Integer())
                ),
            )
        )

        return self._db.execute(statement).rowcount > 0

    def get_stats(self, session_id: UUID) -> SessionStats | None:
        row = self._db.execute(self._stats_query().where(RecordingSession.id == session_id)).first()
        return self._to_stats(row) if row else None

    def list_stats(self) -> Sequence[SessionStats]:
        statement = self._stats_query().order_by(RecordingSession.started_at.desc())
        return [self._to_stats(row) for row in self._db.execute(statement).all()]

    @staticmethod
    def _stats_query() -> Select:
        return (
            select(
                RecordingSession,
                func.count(Sample.t),
                func.coalesce(func.max(Sample.t), 0),
                func.avg(Sample.fps),
                func.coalesce(func.sum(case((Sample.face.is_(True), 1), else_=0)), 0),
                func.coalesce(func.sum(case((Sample.verdict == "good", 1), else_=0)), 0),
            )
            .outerjoin(Sample, Sample.session_id == RecordingSession.id)
            .group_by(RecordingSession.id)
        )

    @staticmethod
    def _to_stats(row: Sequence) -> SessionStats:
        session, saved, last_t, average_fps, face_seconds, good_seconds = row

        return SessionStats(
            session=session,
            samples_saved=int(saved),
            last_t=int(last_t),
            average_fps=float(average_fps) if average_fps is not None else None,
            face_seconds=int(face_seconds),
            good_seconds=int(good_seconds),
        )
