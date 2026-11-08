from flask import Flask

from app.routes.health import health_blueprint
from app.routes.sessions import sessions_blueprint


def register_routes(app: Flask) -> None:
    app.register_blueprint(health_blueprint)
    app.register_blueprint(sessions_blueprint)
