from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from flask import Flask
from sqlalchemy import update
from sqlalchemy.exc import OperationalError

from app import create_app
from app.db.models import RecordingSession
from app.db.session import get_db
from tests.conftest import FRONTEND_ORIGIN


def post_samples(client, session_id, samples):
    return client.post(f"/sessions/{session_id}/samples", json={"samples": samples})


def test_health_reports_database(client):
    response = client.get("/health")

    assert response.status_code == 200
    assert response.get_json()["database"] == "reachable"


def test_health_reports_an_unreachable_database(client, monkeypatch):
    def fail() -> None:
        raise OperationalError("SELECT 1", {}, Exception("down"))

    monkeypatch.setattr("app.routes.health.get_db", fail)
    response = client.get("/health")

    assert response.status_code == 503
    assert response.get_json()["database"] == "unreachable"


def test_create_session_returns_id_and_start_time(client):
    response = client.post("/sessions")
    body = response.get_json()

    assert response.status_code == 201
    assert body["id"]
    assert body["started_at"].endswith("Z")


def test_create_session_with_same_key_returns_original(client):
    headers = {"Idempotency-Key": str(uuid4())}
    first = client.post("/sessions", headers=headers)
    second = client.post("/sessions", headers=headers)

    assert first.status_code == 201
    assert second.status_code == 200
    assert first.get_json()["id"] == second.get_json()["id"]
    assert len(client.get("/sessions").get_json()) == 1


def test_create_session_rejects_invalid_key(client):
    response = client.post("/sessions", headers={"Idempotency-Key": "nope"})

    assert response.status_code == 422


def test_samples_are_saved_in_time_order(client, session_id, make_sample):
    response = post_samples(client, session_id, [make_sample(2), make_sample(1)])

    assert response.get_json() == {"received": 2, "inserted": 2, "duplicates": 0, "ignored": 0}
    samples = client.get(f"/sessions/{session_id}").get_json()["samples"]

    assert [sample["t"] for sample in samples] == [1, 2]


def test_saved_sample_is_returned_exactly_as_sent(client, session_id, make_sample):
    sample = make_sample(1, face=False, verdict="poor", reason="no_face")
    post_samples(client, session_id, [sample])

    assert client.get(f"/sessions/{session_id}").get_json()["samples"] == [sample]


@pytest.mark.parametrize(
    "overrides",
    [
        {"fps": 0},
        {"fps": 120},
        {"brightness": 0},
        {"brightness": 255},
        {"motion": 0},
        {"motion": 255},
        {"t": 0},
    ],
)
def test_values_at_the_range_limits_are_accepted(client, session_id, make_sample, overrides):
    response = post_samples(client, session_id, [make_sample(**overrides)])

    assert response.status_code == 200
    assert response.get_json()["inserted"] == 1


def test_empty_batch_saves_nothing(client, session_id):
    response = post_samples(client, session_id, [])

    assert response.get_json() == {"received": 0, "inserted": 0, "duplicates": 0, "ignored": 0}


def test_resent_samples_are_not_duplicated(client, session_id, make_sample):
    post_samples(client, session_id, [make_sample(1)])
    response = post_samples(client, session_id, [make_sample(1), make_sample(2)])

    assert response.get_json() == {"received": 2, "inserted": 1, "duplicates": 1, "ignored": 0}
    assert len(client.get(f"/sessions/{session_id}").get_json()["samples"]) == 2


@pytest.mark.parametrize(
    "overrides",
    [
        {"fps": 121},
        {"fps": -1},
        {"fps": "30"},
        {"fps": True},
        {"fps": float("nan")},
        {"brightness": 256},
        {"brightness": -1},
        {"motion": 256},
        {"motion": -0.1},
        {"t": -1},
        {"t": 1.5},
        {"t": 3601},
        {"face": "yes"},
        {"verdict": "ok"},
        {"reason": "bad_hair"},
        {"reason": "too_dark"},
        {"extra": 1},
    ],
)
def test_invalid_samples_are_rejected(client, session_id, make_sample, overrides):
    response = post_samples(client, session_id, [make_sample(**overrides)])

    assert response.status_code == 422
    assert response.get_json()["error"]["code"] == "validation_error"
    assert client.get(f"/sessions/{session_id}").get_json()["samples"] == []


def test_missing_field_is_rejected(client, session_id, make_sample):
    sample = make_sample()
    del sample["fps"]

    assert post_samples(client, session_id, [sample]).status_code == 422


def test_poor_verdict_requires_reason(client, session_id, make_sample):
    response = post_samples(client, session_id, [make_sample(verdict="poor")])

    assert response.status_code == 422


def test_oversized_batch_is_rejected(client, session_id, make_sample):
    samples = [make_sample(t) for t in range(1, 7)]

    assert post_samples(client, session_id, samples).status_code == 422


def test_one_invalid_sample_rejects_the_whole_batch(client, session_id, make_sample):
    response = post_samples(client, session_id, [make_sample(1), make_sample(2, fps=500)])

    assert response.status_code == 422
    assert client.get(f"/sessions/{session_id}").get_json()["samples"] == []


def test_malformed_json_returns_json_error(client, session_id):
    response = client.post(
        f"/sessions/{session_id}/samples", data="{bad", content_type="application/json"
    )

    assert response.status_code == 400
    assert "error" in response.get_json()


def test_body_that_is_not_an_object_is_rejected(client, session_id):
    response = client.post(f"/sessions/{session_id}/samples", json=[1, 2])

    assert response.status_code == 422
    assert response.get_json()["error"]["code"] == "validation_error"


def test_oversized_body_returns_json_error(client, session_id):
    response = client.post(
        f"/sessions/{session_id}/samples", data="x" * 70000, content_type="application/json"
    )

    assert response.status_code == 413
    assert "error" in response.get_json()


def test_invalid_session_id_returns_json_error(client):
    response = client.get("/sessions/not-a-uuid")

    assert response.status_code == 404
    assert "error" in response.get_json()


@pytest.mark.parametrize("method, suffix", [("post", "/samples"), ("post", "/stop"), ("get", "")])
def test_unknown_session_returns_404(client, make_sample, method, suffix):
    kwargs = {"json": {"samples": [make_sample()]}} if suffix == "/samples" else {}
    response = getattr(client, method)(f"/sessions/{uuid4()}{suffix}", **kwargs)

    assert response.status_code == 404
    assert response.get_json()["error"]["code"] == "not_found"


def test_stop_twice_keeps_original_end_time(client, session_id):
    first = client.post(f"/sessions/{session_id}/stop", json={"samples_produced": 3})
    second = client.post(f"/sessions/{session_id}/stop", json={"samples_produced": 9})

    assert first.status_code == second.status_code == 200
    assert first.get_json()["ended_at"] == second.get_json()["ended_at"]
    assert second.get_json()["summary"]["samples_missing"] == 3


def test_stop_without_body_is_allowed(client, session_id):
    response = client.post(f"/sessions/{session_id}/stop")

    assert response.status_code == 200
    assert response.get_json()["summary"]["samples_missing"] is None


def test_late_samples_within_grace_are_saved(client, session_id, make_sample):
    client.post(f"/sessions/{session_id}/stop", json={"samples_produced": 1})
    response = post_samples(client, session_id, [make_sample(1)])

    assert response.get_json()["inserted"] == 1
    summary = client.get(f"/sessions/{session_id}").get_json()["summary"]

    assert summary["samples_missing"] == 0


def test_samples_after_grace_are_ignored(app: Flask, client, session_id, make_sample):
    client.post(f"/sessions/{session_id}/stop")

    with app.app_context():
        db = get_db()

        db.execute(
            update(RecordingSession).values(ended_at=datetime.now(UTC) - timedelta(seconds=120))
        )

        db.commit()

    response = post_samples(client, session_id, [make_sample(1)])

    assert response.status_code == 200
    assert response.get_json() == {"received": 1, "inserted": 0, "duplicates": 0, "ignored": 1}


def test_summary_is_calculated_from_samples(client, session_id, make_sample):
    post_samples(
        client,
        session_id,
        [
            make_sample(1, fps=30.0),
            make_sample(2, fps=20.0, face=False, verdict="poor", reason="no_face"),
            make_sample(10, fps=10.0, verdict="poor", reason="low_fps"),
            make_sample(11, fps=20.0),
        ],
    )

    session = client.get(f"/sessions/{session_id}").get_json()
    summary = session["summary"]

    assert session["ended_at"] is None
    assert summary["duration_seconds"] == 11
    assert summary["average_fps"] == 20.0
    assert summary["face_percent"] == 75.0
    assert summary["good_percent"] == 50.0
    assert summary["samples_saved"] == 4
    assert summary["samples_missing"] is None


def test_session_without_samples_has_empty_summary(client, session_id):
    summary = client.get(f"/sessions/{session_id}").get_json()["summary"]

    assert summary["duration_seconds"] == 0
    assert summary["average_fps"] is None
    assert summary["face_percent"] is None
    assert summary["good_percent"] is None


def test_sessions_are_listed_newest_first(client):
    ids = [client.post("/sessions").get_json()["id"] for _ in range(3)]
    listed = client.get("/sessions").get_json()

    assert [session["id"] for session in listed] == list(reversed(ids))


def test_listed_sessions_include_their_summary(client, session_id, make_sample):
    post_samples(client, session_id, [make_sample(4, fps=25.0)])
    summary = client.get("/sessions").get_json()[0]["summary"]

    assert summary["duration_seconds"] == 4
    assert summary["average_fps"] == 25.0
    assert summary["good_percent"] == 100.0


def test_data_survives_restart(settings, client, session_id, make_sample):
    post_samples(client, session_id, [make_sample(1)])
    restarted = create_app(settings).test_client()

    assert len(restarted.get(f"/sessions/{session_id}").get_json()["samples"]) == 1


def test_cors_allows_only_configured_origin(client):
    allowed = client.get("/health", headers={"Origin": FRONTEND_ORIGIN})
    blocked = client.get("/health", headers={"Origin": "http://evil.test"})

    assert allowed.headers.get("Access-Control-Allow-Origin") == FRONTEND_ORIGIN
    assert "Access-Control-Allow-Origin" not in blocked.headers


def test_preflight_allows_the_headers_the_frontend_sends(client):
    response = client.options(
        "/sessions",
        headers={
            "Origin": FRONTEND_ORIGIN,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type, idempotency-key",
        },
    )

    assert response.status_code == 200
    assert response.headers["Access-Control-Allow-Origin"] == FRONTEND_ORIGIN
    allowed = response.headers["Access-Control-Allow-Headers"].lower()

    assert "content-type" in allowed
    assert "idempotency-key" in allowed


def test_unknown_route_returns_json_error(client):
    response = client.get("/nope")

    assert response.status_code == 404
    assert "error" in response.get_json()
