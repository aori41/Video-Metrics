from hashlib import sha256
from ipaddress import ip_address, ip_network
from time import time

from sqlalchemy.orm import Session

from app.config import Settings
from app.errors import RateLimitedError
from app.repositories.rate_limit_repository import RateLimitRepository


def _client_hash(address: str) -> str:
    return sha256(_rate_limited_network(address).encode()).hexdigest()


def _rate_limited_network(address: str) -> str:
    try:
        version = ip_address(address).version
    except ValueError:
        return address

    # One IPv6 customer owns a whole /64, so limiting single addresses is easy to bypass.
    return str(ip_network(f"{address}/64", strict=False)) if version == 6 else address


class RateLimiter:
    def __init__(self, db: Session, settings: Settings) -> None:
        self._db = db
        self._window_seconds = settings.rate_limit_window_seconds
        self._counters = RateLimitRepository(db)

    def check(self, bucket: str, limit: int, client_address: str) -> None:
        now = int(time())

        hits = self._counters.record_hit(
            bucket, _client_hash(client_address), now // self._window_seconds
        )

        self._db.commit()

        if hits > limit:
            retry_after = self._window_seconds - now % self._window_seconds

            raise RateLimitedError(
                f"Too many requests. Try again in {retry_after} seconds", retry_after
            )
