from uuid import UUID

from flask import Blueprint, Response, current_app, jsonify

from app.db.session import get_db
from app.middlewares.request_guards import enforce_rate_limit, reject_foreign_origin
from app.routes.request_parsing import (
    parse_idempotency_key,
    parse_json_body,
    parse_optional_json_body,
)
from app.schemas.sample import SampleBatchIn
from app.schemas.session import StopSessionIn
from app.services.session_service import SessionService

sessions_blueprint = Blueprint("sessions", __name__, url_prefix="/sessions")
sessions_blueprint.before_request(reject_foreign_origin)
sessions_blueprint.before_request(enforce_rate_limit)


def _service() -> SessionService:
    return SessionService(get_db(), current_app.config["SETTINGS"])


@sessions_blueprint.post("")
def create_session() -> tuple[Response, int]:
    session, created = _service().create(parse_idempotency_key())
    return jsonify(session.model_dump(mode="json")), 201 if created else 200


@sessions_blueprint.post("/<uuid:session_id>/samples")
def add_samples(session_id: UUID) -> Response:
    result = _service().add_samples(session_id, parse_json_body(SampleBatchIn))
    return jsonify(result.model_dump(mode="json"))


@sessions_blueprint.post("/<uuid:session_id>/stop")
def stop_session(session_id: UUID) -> Response:
    session = _service().stop(session_id, parse_optional_json_body(StopSessionIn))
    return jsonify(session.model_dump(mode="json"))


@sessions_blueprint.get("")
def list_sessions() -> Response:
    return jsonify([session.model_dump(mode="json") for session in _service().list_sessions()])


@sessions_blueprint.get("/<uuid:session_id>")
def get_session(session_id: UUID) -> Response:
    return jsonify(_service().get(session_id).model_dump(mode="json"))
