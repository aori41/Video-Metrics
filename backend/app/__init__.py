from flask import Flask
from flask_cors import CORS

from app.config import Settings
from app.db.session import init_db
from app.middlewares import register_middlewares
from app.routes import register_routes
from app.utils.logger import init_logging


def create_app(settings: Settings | None = None) -> Flask:
    resolved = settings or Settings()

    app = Flask(__name__)
    app.config["SETTINGS"] = resolved
    app.config["MAX_CONTENT_LENGTH"] = resolved.max_request_bytes
    app.json.sort_keys = False
    init_logging(app, resolved)
    init_db(app, resolved.database_url)

    CORS(
        app,
        origins=resolved.cors_origins,
        methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type", "Idempotency-Key"],
    )

    register_middlewares(app)
    register_routes(app)

    return app
