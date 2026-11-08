import logging

from flask import Blueprint, Response, jsonify
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.db.session import get_db

logger = logging.getLogger(__name__)
health_blueprint = Blueprint("health", __name__)


@health_blueprint.get("/health")
def health() -> tuple[Response, int]:
    try:
        get_db().execute(text("SELECT 1"))
    except SQLAlchemyError:
        logger.exception("database_unreachable")
        return jsonify(status="unavailable", database="unreachable"), 503

    return jsonify(status="ok", database="reachable"), 200
