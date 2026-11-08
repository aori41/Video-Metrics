import logging
from time import perf_counter
from uuid import uuid4

from flask import Flask, Response, g, request

from app.utils.logger import log_fields

logger = logging.getLogger(__name__)


def _start_request() -> None:
    g.request_id = str(uuid4())
    g.request_started = perf_counter()


def _finish_request(response: Response) -> Response:
    logger.info(
        "request_completed",
        **log_fields(
            method=request.method,
            path=request.path,
            status=response.status_code,
            duration_ms=round((perf_counter() - g.request_started) * 1000, 1),
        ),
    )

    response.headers["X-Request-Id"] = g.request_id

    return response


def register_request_logging(app: Flask) -> None:
    app.before_request(_start_request)
    app.after_request(_finish_request)
