from typing import TypeVar
from uuid import UUID

from flask import request
from pydantic import BaseModel

from app.errors import RequestValidationError

Model = TypeVar("Model", bound=BaseModel)


def parse_json_body(model: type[Model]) -> Model:
    return model.model_validate(request.get_json())


def parse_optional_json_body(model: type[Model]) -> Model:
    return model.model_validate(request.get_json() if request.get_data() else {})


def parse_idempotency_key() -> UUID | None:
    header = request.headers.get("Idempotency-Key")
    if header is None:
        return None

    try:
        return UUID(header)
    except ValueError as error:
        raise RequestValidationError("Idempotency-Key must be a UUID") from error
