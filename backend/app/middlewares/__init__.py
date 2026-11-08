from flask import Flask

from app.middlewares.error_handlers import register_error_handlers
from app.middlewares.request_logging import register_request_logging


def register_middlewares(app: Flask) -> None:
    register_request_logging(app)
    register_error_handlers(app)
