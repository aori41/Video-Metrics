import json
import logging
import re
from collections.abc import Callable, Iterator
from datetime import UTC, datetime, timedelta
from io import StringIO
from typing import Any

import pytest
from flask import Flask
from sqlalchemy import update

from app.db.models import RecordingSession
from app.db.session import get_db
from app.services.session_service import SessionService
from app.utils.logger import LogFormatter

LogReader = Callable[[str], list[dict[str, Any]]]
LOG_LINE = re.compile(
    r"^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] (?P<level>[A-Z]+): "
    r"(?P<event>\S+)(?: (?P<data>\{.*\}))?$"
)


@pytest.fixture
def events(app: Flask) -> Iterator[LogReader]:
    stream = StringIO()
    handler = logging.StreamHandler(stream)
    handler.setFormatter(LogFormatter())
    logger = logging.getLogger("app")
    logger.addHandler(handler)

    def read(event: str) -> list[dict[str, Any]]:
        matches = [LOG_LINE.match(line) for line in stream.getvalue().splitlines()]

        entries = [
            {"level": match["level"], "event": match["event"], **json.loads(match["data"] or "{}")}
            for match in matches
            if match
        ]

        return [entry for entry in entries if entry["event"] == event]

    read.output = stream.getvalue
    yield read
    logger.removeHandler(handler)


def test_logger_has_one_handler_and_does_not_duplicate_lines(app: Flask):
    log_handlers = [
        handler for handler in app.logger.handlers if isinstance(handler.formatter, LogFormatter)
    ]

    assert len(log_handlers) == 1
    assert app.logger.propagate is False


def test_each_request_is_logged_with_the_returned_request_id(client, events):
    response = client.get("/health")
    entry = events("request_completed")[0]

    assert entry["request_id"] == response.headers["X-Request-Id"]
    assert entry["method"] == "GET"
    assert entry["path"] == "/health"
    assert entry["status"] == 200
    assert entry["duration_ms"] >= 0
    assert entry["level"] == "INFO"


def test_stopped_session_is_logged(client, session_id, make_sample, events):
    client.post(f"/sessions/{session_id}/samples", json={"samples": [make_sample(1)]})
    client.post(f"/sessions/{session_id}/stop", json={"samples_produced": 1})
    entry = events("session_stopped")[0]

    assert entry["session_id"] == session_id
    assert entry["samples_saved"] == 1
    assert entry["samples_missing"] == 0
    assert entry["level"] == "INFO"


def test_missing_samples_are_a_warning(client, session_id, events):
    client.post(f"/sessions/{session_id}/stop", json={"samples_produced": 3})
    entry = events("session_stopped")[0]

    assert entry["samples_missing"] == 3
    assert entry["level"] == "WARNING"


def test_resent_samples_are_logged_as_duplicates(client, session_id, make_sample, events):
    body = {"samples": [make_sample(1)]}
    client.post(f"/sessions/{session_id}/samples", json=body)
    client.post(f"/sessions/{session_id}/samples", json=body)

    assert events("samples_saved")[-1]["duplicates"] == 1


def test_rejected_input_is_logged_without_the_submitted_value(
    client, session_id, make_sample, events
):
    response = client.post(
        f"/sessions/{session_id}/samples",
        json={"samples": [make_sample(1, verdict="secret-value")]},
    )

    assert response.status_code == 422
    assert events("request_rejected")
    assert "secret-value" not in events.output()


def test_late_samples_are_a_warning(app: Flask, client, session_id, make_sample, events):
    client.post(f"/sessions/{session_id}/stop")

    with app.app_context():
        db = get_db()

        db.execute(
            update(RecordingSession).values(ended_at=datetime.now(UTC) - timedelta(seconds=120))
        )

        db.commit()

    client.post(f"/sessions/{session_id}/samples", json={"samples": [make_sample(1)]})
    entry = events("late_samples_ignored")[0]

    assert entry["ignored"] == 1
    assert entry["level"] == "WARNING"


def test_unhandled_error_logs_stack_trace_and_request_id(client, events, monkeypatch):
    def fail(*_args: Any) -> None:
        raise RuntimeError("database exploded")

    monkeypatch.setattr(SessionService, "list_sessions", fail)
    response = client.get("/sessions")

    entry = events("unhandled_error")[0]

    assert response.status_code == 500
    assert "database exploded" not in response.get_data(as_text=True)
    assert "RuntimeError: database exploded" in events.output()
    assert entry["request_id"] == response.headers["X-Request-Id"]
    assert entry["level"] == "ERROR"
