from flask import Flask

from app.routes.health import health_blueprint


def register_routes(app: Flask) -> None:
    app.register_blueprint(health_blueprint)
