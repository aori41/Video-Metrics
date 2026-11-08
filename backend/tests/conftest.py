from collections.abc import Callable, Iterator
from typing import Any

import pytest
from flask import Flask
from flask.testing import FlaskClient
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import create_engine, make_url

from app import create_app
from app.config import ENV_FILE, Settings
from app.db.base import Base
from app.db.create_database import create_database_if_missing

FRONTEND_ORIGIN = "http://frontend.test"
TEST_DATABASE_SUFFIX = "_test"


class DatabaseForTests(BaseSettings):
    model_config = SettingsConfigDict(env_file=ENV_FILE, extra="ignore")

    test_database_url: str


@pytest.fixture(scope="session")
def base_settings() -> Settings:
    resolved = Settings(
        _env_file=None,
        database_url=DatabaseForTests().test_database_url,
        cors_allowed_origins=FRONTEND_ORIGIN,
        max_batch_size=5,
        max_session_seconds=3600,
        late_sample_grace_seconds=60,
        max_request_bytes=65536,
        rate_limit_window_seconds=60,
        rate_limit_create_per_window=1000,
        rate_limit_requests_per_window=1000,
        trusted_proxy_hops=0,
        log_level="INFO",
    )

    # Every test erases all tables, so a real database must never be used here.
    if not str(make_url(resolved.database_url).database).endswith(TEST_DATABASE_SUFFIX):
        pytest.exit(f"TEST_DATABASE_URL must name a database ending in {TEST_DATABASE_SUFFIX}", 1)

    create_database_if_missing(resolved.database_url)

    return resolved


@pytest.fixture
def settings(base_settings: Settings) -> Settings:
    engine = create_engine(base_settings.database_url)
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    engine.dispose()

    return base_settings


@pytest.fixture
def app(settings: Settings) -> Flask:
    return create_app(settings)


@pytest.fixture
def client(app: Flask) -> Iterator[FlaskClient]:
    with app.test_client() as test_client:
        yield test_client


@pytest.fixture
def make_sample() -> Callable[..., dict[str, Any]]:
    def build(t: int = 1, **overrides: Any) -> dict[str, Any]:
        return {
            "t": t,
            "fps": 29.6,
            "brightness": 132.4,
            "motion": 3.1,
            "face": True,
            "verdict": "good",
            "reason": None,
            **overrides,
        }

    return build


@pytest.fixture
def session_id(client: FlaskClient) -> str:
    return client.post("/sessions").get_json()["id"]
