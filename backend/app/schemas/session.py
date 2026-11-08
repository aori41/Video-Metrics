from datetime import datetime
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.sample import SampleOut


class SessionCreated(BaseModel):
    id: UUID
    started_at: datetime


class StopSessionIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    samples_produced: Annotated[int | None, Field(strict=True, ge=0)] = None


class SessionSummary(BaseModel):
    duration_seconds: int
    average_fps: float | None
    face_percent: float | None
    good_percent: float | None
    samples_saved: int
    samples_missing: int | None


class SessionOut(BaseModel):
    id: UUID
    started_at: datetime
    ended_at: datetime | None
    summary: SessionSummary


class SessionDetailOut(SessionOut):
    samples: list[SampleOut]
