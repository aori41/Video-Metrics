import json
import logging
import sys
from datetime import UTC, datetime
from typing import Any

from flask import Flask, g, has_request_context

from app.config import Settings


def log_fields(**fields: Any) -> dict[str, dict[str, Any]]:
    return {"extra": {"fields": fields}}


class LogFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        created = datetime.fromtimestamp(record.created, UTC)
        timestamp = created.isoformat(timespec="milliseconds").replace("+00:00", "Z")
        line = f"[{timestamp}] {record.levelname}: {record.getMessage()}"

        request_id = g.get("request_id") if has_request_context() else None

        data = {
            **({"request_id": request_id} if request_id else {}),
            **getattr(record, "fields", {}),
        }

        if data:
            line += f" {json.dumps(data, default=str)}"

        if record.exc_info:
            line += f"\n{self.formatException(record.exc_info)}"

        return line


def init_logging(app: Flask, settings: Settings) -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(LogFormatter())

    app.logger.handlers.clear()
    app.logger.addHandler(handler)
    app.logger.setLevel(settings.log_level)
    app.logger.propagate = False
