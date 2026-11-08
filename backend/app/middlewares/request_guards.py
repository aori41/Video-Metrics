from flask import current_app, request

from app.db.session import get_db
from app.errors import ForbiddenOriginError
from app.services.rate_limiter import RateLimiter

CREATE_SESSION_ENDPOINT = "sessions.create_session"


def reject_foreign_origin() -> None:
    origin = request.headers.get("Origin")
    if origin and origin not in current_app.config["SETTINGS"].cors_origins:
        raise ForbiddenOriginError("This origin is not allowed to call the API")


def enforce_rate_limit() -> None:
    if request.method == "OPTIONS":
        return

    settings = current_app.config["SETTINGS"]
    is_create = request.endpoint == CREATE_SESSION_ENDPOINT

    RateLimiter(get_db(), settings).check(
        "create" if is_create else "requests",
        settings.rate_limit_create_per_window
        if is_create
        else settings.rate_limit_requests_per_window,
        request.remote_addr or "unknown",
    )
