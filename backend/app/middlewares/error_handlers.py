import logging
from typing import Any

from flask import Flask, Response, jsonify
from pydantic import ValidationError
from werkzeug.exceptions import HTTPException

from app.errors import ApiError
from app.utils.logger import log_fields

logger = logging.getLogger(__name__)


def _error_response(
    status: int, code: str, message: str, details: list[dict[str, Any]] | None = None
) -> tuple[Response, int]:
    return jsonify(error={"code": code, "message": message, "details": details or []}), status


def _rejected_response(
    status: int, code: str, message: str, details: list[dict[str, Any]] | None = None
) -> tuple[Response, int]:
    level = logging.WARNING if status < 500 else logging.ERROR
    logger.log(level, "request_rejected", **log_fields(status=status, code=code, reason=message))

    return _error_response(status, code, message, details)


def _format_validation_error(error: ValidationError) -> list[dict[str, Any]]:
    return [
        {
            "field": ".".join(str(part) for part in item["loc"]) or "body",
            "message": item["msg"],
            "type": item["type"],
        }
        for item in error.errors(include_url=False, include_context=False, include_input=False)
    ]


def _handle_api_error(error: ApiError) -> tuple[Response, int]:
    return _rejected_response(error.status_code, error.code, error.message, error.details)


def _handle_validation_error(error: ValidationError) -> tuple[Response, int]:
    details = _format_validation_error(error)
    first = details[0]

    return _rejected_response(
        422, "validation_error", f"{first['field']}: {first['message']}", details
    )


def _handle_http_exception(error: HTTPException) -> tuple[Response, int]:
    code = (error.name or "http_error").lower().replace(" ", "_")
    return _rejected_response(error.code or 500, code, error.description or "Request failed")


def _handle_unexpected_error(error: Exception) -> tuple[Response, int]:
    logger.exception("unhandled_error", exc_info=error)
    return _error_response(500, "internal_error", "An unexpected error occurred")


def register_error_handlers(app: Flask) -> None:
    app.register_error_handler(ApiError, _handle_api_error)
    app.register_error_handler(ValidationError, _handle_validation_error)
    app.register_error_handler(HTTPException, _handle_http_exception)
    app.register_error_handler(Exception, _handle_unexpected_error)
