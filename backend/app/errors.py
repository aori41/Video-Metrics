from typing import Any


class ApiError(Exception):
    status_code = 400
    code = "bad_request"

    def __init__(self, message: str, details: list[dict[str, Any]] | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details or []


class NotFoundError(ApiError):
    status_code = 404
    code = "not_found"


class RequestValidationError(ApiError):
    status_code = 422
    code = "validation_error"
