from collections.abc import Callable

import pytest
from flask.testing import FlaskClient
from sqlalchemy import create_engine, select

from app import create_app
from app.config import Settings
from app.db.models import RateLimitCounter, RecordingSession
from tests.conftest import FRONTEND_ORIGIN

CLIENT_A = {"REMOTE_ADDR": "203.0.113.1"}
CLIENT_B = {"REMOTE_ADDR": "203.0.113.2"}
START_TIME = 1_000_000_020


@pytest.fixture
def set_time(monkeypatch: pytest.MonkeyPatch) -> Callable[[int], None]:
    def apply(now: int) -> None:
        monkeypatch.setattr("app.services.rate_limiter.time", lambda: now)

    apply(START_TIME)

    return apply


@pytest.fixture
def build_client(settings: Settings, set_time) -> Callable[..., FlaskClient]:
    def build(**overrides: int) -> FlaskClient:
        limits = {
            "rate_limit_create_per_window": 2,
            "rate_limit_requests_per_window": 3,
            **overrides,
        }

        return create_app(settings.model_copy(update=limits)).test_client()

    return build


@pytest.fixture
def limited(build_client) -> FlaskClient:
    return build_client()


def create(client: FlaskClient, environ: dict[str, str] = CLIENT_A, **kwargs):
    return client.post("/sessions", environ_overrides=environ, **kwargs)


def test_creating_too_many_sessions_returns_429_with_json_error(limited):
    assert [create(limited).status_code for _ in range(2)] == [201, 201]

    rejected = create(limited)

    assert rejected.status_code == 429
    assert rejected.get_json()["error"]["code"] == "rate_limited"
    assert rejected.headers["Retry-After"] == str(60 - START_TIME % 60)


def test_general_limit_applies_to_reads(limited):
    statuses = [
        limited.get("/sessions", environ_overrides=CLIENT_A).status_code for _ in range(4)
    ]

    assert statuses == [200, 200, 200, 429]


def test_creating_sessions_does_not_use_up_the_general_limit(limited):
    create(limited)
    create(limited)

    assert limited.get("/sessions", environ_overrides=CLIENT_A).status_code == 200


def test_browser_can_read_the_429_response(limited):
    headers = {"Origin": FRONTEND_ORIGIN}
    create(limited, headers=headers)
    create(limited, headers=headers)

    rejected = create(limited, headers=headers)

    assert rejected.status_code == 429
    assert rejected.headers["Access-Control-Allow-Origin"] == FRONTEND_ORIGIN


def test_limit_resets_in_the_next_window(limited, set_time):
    create(limited)
    create(limited)

    assert create(limited).status_code == 429

    set_time(START_TIME + 60)

    assert create(limited).status_code == 201


def test_clients_are_limited_separately(limited):
    create(limited, CLIENT_A)
    create(limited, CLIENT_A)

    assert create(limited, CLIENT_A).status_code == 429
    assert create(limited, CLIENT_B).status_code == 201


def test_ipv6_addresses_in_one_network_share_a_limit(limited):
    create(limited, {"REMOTE_ADDR": "2001:db8:0:1::a"})
    create(limited, {"REMOTE_ADDR": "2001:db8:0:1::b"})

    assert create(limited, {"REMOTE_ADDR": "2001:db8:0:1::c"}).status_code == 429
    assert create(limited, {"REMOTE_ADDR": "2001:db8:0:2::a"}).status_code == 201


def test_preflight_and_health_are_not_limited(limited):
    preflight_headers = {
        "Origin": FRONTEND_ORIGIN,
        "Access-Control-Request-Method": "POST",
    }

    for _ in range(5):
        preflight = limited.options(
            "/sessions", headers=preflight_headers, environ_overrides=CLIENT_A
        )

        health = limited.get("/health", environ_overrides=CLIENT_A)

        assert preflight.status_code == 200
        assert health.status_code == 200


def test_forwarded_address_is_ignored_without_a_trusted_proxy(limited):
    for forwarded_for in ("198.51.100.1", "198.51.100.2"):
        create(limited, headers={"X-Forwarded-For": forwarded_for})

    assert create(limited, headers={"X-Forwarded-For": "198.51.100.3"}).status_code == 429


def test_forwarded_address_identifies_the_client_behind_a_trusted_proxy(build_client):
    client = build_client(trusted_proxy_hops=1)
    create(client, headers={"X-Forwarded-For": "198.51.100.1"})
    create(client, headers={"X-Forwarded-For": "198.51.100.1"})

    assert create(client, headers={"X-Forwarded-For": "198.51.100.1"}).status_code == 429
    assert create(client, headers={"X-Forwarded-For": "198.51.100.2"}).status_code == 201


def test_ip_addresses_are_not_stored(limited, settings):
    create(limited)

    engine = create_engine(settings.database_url)
    with engine.connect() as connection:
        stored = connection.scalars(select(RateLimitCounter.client_hash)).all()

    engine.dispose()

    assert len(stored) == 1
    assert CLIENT_A["REMOTE_ADDR"] not in stored[0]


def test_foreign_origin_is_rejected_before_any_write(client, settings):
    response = client.post("/sessions", headers={"Origin": "http://evil.test"})

    assert response.status_code == 403
    assert response.get_json()["error"]["code"] == "forbidden_origin"
    engine = create_engine(settings.database_url)
    with engine.connect() as connection:
        assert connection.scalars(select(RecordingSession.id)).all() == []

    engine.dispose()


def test_configured_origin_and_non_browser_clients_are_allowed(client):
    assert client.post("/sessions", headers={"Origin": FRONTEND_ORIGIN}).status_code == 201
    assert client.post("/sessions").status_code == 201
