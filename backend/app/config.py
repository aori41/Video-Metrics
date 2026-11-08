from pathlib import Path
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

ENV_FILE = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ENV_FILE, extra="ignore")

    database_url: str
    cors_allowed_origins: str
    max_batch_size: int = Field(gt=0)
    max_session_seconds: int = Field(gt=0)
    late_sample_grace_seconds: int = Field(ge=0)
    max_request_bytes: int = Field(gt=0)
    rate_limit_window_seconds: int = Field(gt=0)
    rate_limit_create_per_window: int = Field(gt=0)
    rate_limit_requests_per_window: int = Field(gt=0)
    trusted_proxy_hops: int = Field(ge=0)
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"]

    @field_validator("database_url")
    @classmethod
    def use_psycopg_driver(cls, value: str) -> str:
        for prefix in ("postgres://", "postgresql://"):
            if value.startswith(prefix):
                return "postgresql+psycopg://" + value.removeprefix(prefix)

        return value

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_allowed_origins.split(",") if origin.strip()]
