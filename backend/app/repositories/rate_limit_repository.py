from sqlalchemy import case
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.db.models import RateLimitCounter


class RateLimitRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def record_hit(self, bucket: str, client_hash: str, window_start: int) -> int:
        new_counter = insert(RateLimitCounter).values(
            bucket=bucket, client_hash=client_hash, window_start=window_start, hits=1
        )

        same_window = RateLimitCounter.window_start == new_counter.excluded.window_start

        statement = new_counter.on_conflict_do_update(
            index_elements=["bucket", "client_hash"],
            set_={
                "window_start": new_counter.excluded.window_start,
                "hits": case((same_window, RateLimitCounter.hits + 1), else_=1),
            },
        ).returning(RateLimitCounter.hits)

        return self._db.execute(statement).scalar_one()
