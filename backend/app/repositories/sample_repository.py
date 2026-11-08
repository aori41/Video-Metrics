from collections.abc import Sequence
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.db.models import Sample


class SampleRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def insert_new(self, session_id: UUID, samples: Sequence[dict[str, Any]]) -> int:
        if not samples:
            return 0

        rows = [{"session_id": session_id, **sample} for sample in samples]

        statement = (
            insert(Sample)
            .values(rows)
            .on_conflict_do_nothing(index_elements=["session_id", "t"])
            .returning(Sample.t)
        )

        return len(self._db.execute(statement).all())

    def list_for_session(self, session_id: UUID) -> Sequence[Sample]:
        statement = select(Sample).where(Sample.session_id == session_id).order_by(Sample.t)
        return self._db.scalars(statement).all()
