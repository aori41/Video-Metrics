from app.repositories.session_repository import SessionStats
from app.schemas.session import SessionOut, SessionSummary


def _percent(part: int, total: int) -> float | None:
    return round(part / total * 100, 2) if total else None


def build_summary(stats: SessionStats) -> SessionSummary:
    produced = stats.session.samples_produced

    return SessionSummary(
        duration_seconds=stats.last_t,
        average_fps=round(stats.average_fps, 2) if stats.average_fps is not None else None,
        face_percent=_percent(stats.face_seconds, stats.samples_saved),
        good_percent=_percent(stats.good_seconds, stats.samples_saved),
        samples_saved=stats.samples_saved,
        samples_missing=max(produced - stats.samples_saved, 0) if produced is not None else None,
    )


def build_session_out(stats: SessionStats) -> SessionOut:
    return SessionOut(
        id=stats.session.id,
        started_at=stats.session.started_at,
        ended_at=stats.session.ended_at,
        summary=build_summary(stats),
    )
