"""
services/utils.py — 서비스 계층 공통 유틸리티
"""
from datetime import date
from typing import Any

from app.client.redmine_client import RedmineClient
from app.core.cache import TTLCache
from app.core.config import Settings


def calc_overdue(due_str: str | None, today: date) -> tuple[bool, int]:
    """
    기한 초과 여부와 초과 일수를 계산하여 반환.
    due_str이 None이거나 아직 기한 내이면 (False, 0) 반환.
    """
    if not due_str:
        return False, 0
    due_date = date.fromisoformat(due_str)
    if due_date < today:
        return True, (today - due_date).days
    return False, 0


def parse_api_date(value: str | None) -> date | None:
    if not value:
        return None

    try:
        return date.fromisoformat(value[:10])
    except ValueError:
        return None


def resolve_project_id(project_id: str | None, settings: Settings) -> str:
    return project_id or settings.dashboard.default_project


async def fetch_project_issues(
    *,
    client: RedmineClient,
    cache: TTLCache,
    settings: Settings,
    project_id: str,
) -> list[dict[str, Any]]:
    cache_key = f"issues:{project_id}"

    async def _factory() -> list[dict[str, Any]]:
        params: dict[str, Any] = {
            "project_id": project_id,
            "status_id": "*",
        }
        if not settings.dashboard.include_subprojects:
            params["subproject_id"] = "!*"
        return await client.fetch_all_issues(params)

    return await cache.get_or_set(
        cache_key,
        _factory,
        ttl=settings.dashboard.cache_ttl_seconds,
    )
