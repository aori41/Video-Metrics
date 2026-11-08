import logging
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy.orm import Session

from app.config import Settings
from app.db.models import RecordingSession
from app.errors import NotFoundError, RequestValidationError
from app.repositories.sample_repository import SampleRepository
from app.repositories.session_repository import SessionRepository, SessionStats
from app.schemas.sample import SampleBatchIn, SampleBatchResult, SampleOut
from app.schemas.session import (
    SessionCreated,
    SessionDetailOut,
    SessionOut,
    StopSessionIn,
)
from app.services.summary import build_session_out
from app.utils.logger import log_fields

logger = logging.getLogger(__name__)


class SessionService:
    def __init__(self, db: Session, settings: Settings) -> None:
        self._db = db
        self._settings = settings
        self._sessions = SessionRepository(db)
        self._samples = SampleRepository(db)

    def create(self, idempotency_key: UUID | None) -> tuple[SessionCreated, bool]:
        session, created = self._sessions.create(datetime.now(UTC), idempotency_key)
        self._db.commit()
        logger.info("session_created", **log_fields(session_id=session.id, replayed=not created))

        return SessionCreated(id=session.id, started_at=session.started_at), created

    def add_samples(self, session_id: UUID, batch: SampleBatchIn) -> SampleBatchResult:
        session = self._require_session(session_id)
        self._validate_batch(batch)

        received = len(batch.samples)
        if self._is_past_grace_period(session):
            logger.warning(
                "late_samples_ignored", **log_fields(session_id=session_id, ignored=received)
            )

            return SampleBatchResult(received=received, inserted=0, duplicates=0, ignored=received)

        inserted = self._samples.insert_new(
            session_id, [sample.model_dump() for sample in batch.samples]
        )

        self._db.commit()
        duplicates = received - inserted

        logger.log(
            logging.INFO if duplicates else logging.DEBUG,
            "samples_saved",
            **log_fields(session_id=session_id, inserted=inserted, duplicates=duplicates),
        )

        return SampleBatchResult(
            received=received, inserted=inserted, duplicates=duplicates, ignored=0
        )

    def stop(self, session_id: UUID, body: StopSessionIn) -> SessionOut:
        stopped = self._sessions.mark_stopped(session_id, datetime.now(UTC), body.samples_produced)
        if not stopped:
            raise self._not_found(session_id)

        self._db.commit()

        out = build_session_out(self._require_stats(session_id))

        logger.log(
            logging.WARNING if out.summary.samples_missing else logging.INFO,
            "session_stopped",
            **log_fields(
                session_id=session_id,
                samples_saved=out.summary.samples_saved,
                samples_missing=out.summary.samples_missing,
            ),
        )

        return out

    def list_sessions(self) -> list[SessionOut]:
        return [build_session_out(stats) for stats in self._sessions.list_stats()]

    def get(self, session_id: UUID) -> SessionDetailOut:
        out = build_session_out(self._require_stats(session_id))

        samples = [
            SampleOut.model_validate(sample)
            for sample in self._samples.list_for_session(session_id)
        ]

        return SessionDetailOut(**out.model_dump(), samples=samples)

    def _validate_batch(self, batch: SampleBatchIn) -> None:
        if len(batch.samples) > self._settings.max_batch_size:
            raise RequestValidationError(
                f"A batch can hold at most {self._settings.max_batch_size} samples"
            )

        if any(sample.t > self._settings.max_session_seconds for sample in batch.samples):
            raise RequestValidationError(
                f"t must be at most {self._settings.max_session_seconds} seconds"
            )

    def _is_past_grace_period(self, session: RecordingSession) -> bool:
        if session.ended_at is None:
            return False

        grace = timedelta(seconds=self._settings.late_sample_grace_seconds)

        return datetime.now(UTC) > session.ended_at + grace

    def _require_session(self, session_id: UUID) -> RecordingSession:
        session = self._sessions.get(session_id)
        if session is None:
            raise self._not_found(session_id)

        return session

    def _require_stats(self, session_id: UUID) -> SessionStats:
        stats = self._sessions.get_stats(session_id)
        if stats is None:
            raise self._not_found(session_id)

        return stats

    @staticmethod
    def _not_found(session_id: UUID) -> NotFoundError:
        return NotFoundError(f"Session {session_id} was not found")
