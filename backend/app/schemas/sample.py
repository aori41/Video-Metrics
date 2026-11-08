from typing import Annotated, Literal, Self

from pydantic import BaseModel, ConfigDict, Field, model_validator

Verdict = Literal["good", "poor"]
Reason = Literal["no_face", "too_dark", "too_bright", "hold_still", "low_fps"]
Luma = Annotated[float, Field(strict=True, ge=0, le=255, allow_inf_nan=False)]


class SampleModel(BaseModel):
    model_config = ConfigDict(extra="forbid")

    t: Annotated[int, Field(strict=True, ge=0)]
    fps: Annotated[float, Field(strict=True, ge=0, le=120, allow_inf_nan=False)]
    brightness: Luma
    motion: Luma
    face: Annotated[bool, Field(strict=True)]
    verdict: Verdict
    reason: Reason | None

    @model_validator(mode="after")
    def verdict_matches_reason(self) -> Self:
        if self.verdict == "good" and self.reason is not None:
            raise ValueError("reason must be null when verdict is good")

        if self.verdict == "poor" and self.reason is None:
            raise ValueError("reason is required when verdict is poor")

        return self


class SampleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    t: int
    fps: float
    brightness: float
    motion: float
    face: bool
    verdict: str
    reason: str | None


class SampleBatchIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    samples: list[SampleModel]


class SampleBatchResult(BaseModel):
    received: int
    inserted: int
    duplicates: int
    ignored: int
