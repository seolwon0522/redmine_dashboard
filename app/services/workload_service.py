"""
services/workload_service.py — 담당자별 워크로드 집계
미할당 이슈는 "미할당" 키로 별도 집계
"""
from collections import defaultdict
from datetime import date, datetime

from app.client.redmine_client import RedmineClient
from app.core.cache import TTLCache
from app.core.config import Settings
from app.services.utils import calc_overdue


class WorkloadService:
    """담당자별 워크로드 서비스"""

    def __init__(self, client: RedmineClient, cache: TTLCache, settings: Settings):
        self._client = client
        self._cache = cache
        self._settings = settings

    async def get_workload(self, project_id: str | None = None) -> dict:
        """담당자별 open 이슈 수 + overdue 이슈 수 반환"""
        pid = project_id or self._settings.dashboard.default_project

        # 공유 캐시(issues:{pid})를 재사용하여 중복 조회 방지
        all_issues = await self._fetch_project_issues(pid)

        today = date.today()
        closed_ids = self._settings.get_excluded_status_ids(("closed",))
        overdue_exclude = self._settings.get_excluded_status_ids(
            self._settings.dashboard.overdue_rule.exclude_status_groups
        )

        # 담당자별 집계 구조: {user_id: {"name": str, "open": int, "overdue": int}}
        workload: dict[int | None, dict] = defaultdict(
            lambda: {"name": "미할당", "open": 0, "overdue": 0}
        )

        for issue in all_issues:
            status_id = issue.get("status", {}).get("id")

            # closed 그룹 이슈는 워크로드에서 제외
            if status_id in closed_ids:
                continue

            assigned = issue.get("assigned_to")
            user_id = assigned.get("id") if assigned else None
            user_name = assigned.get("name") if assigned else "미할당"

            entry = workload[user_id]
            entry["name"] = user_name
            entry["open"] += 1

            # 기한 초과 여부 확인
            if status_id not in overdue_exclude:
                is_overdue, _ = calc_overdue(issue.get("due_date"), today)
                if is_overdue:
                    entry["overdue"] += 1

        # 정렬: open 이슈 수 기준 내림차순
        result = []
        for user_id, data in sorted(
            workload.items(),
            key=lambda x: x[1]["open"],
            reverse=True,
        ):
            result.append({
                "user_id": user_id,
                "name": data["name"],
                "open_issues": data["open"],
                "overdue_issues": data["overdue"],
            })

        return {
            "project_id": pid,
            "workload": result,
            "cached_at": datetime.now(),
        }

    async def _fetch_project_issues(self, project_id: str) -> list[dict]:
        """프로젝트 전체 이슈를 캐시 경유 조회 (IssueService와 동일한 캐시 키 재사용)"""
        cache_key = f"issues:{project_id}"

        async def _factory():
            params: dict = {
                "project_id": project_id,
                "status_id": "*",
            }
            if not self._settings.dashboard.include_subprojects:
                params["subproject_id"] = "!*"
            return await self._client.fetch_all_issues(params)

        return await self._cache.get_or_set(
            cache_key,
            _factory,
            ttl=self._settings.dashboard.cache_ttl_seconds,
        )

    async def get_member_issues(
        self,
        user_id: int | None = None,
        unassigned: bool = False,
        project_id: str | None = None,
    ) -> dict:
        """
        특정 담당자의 오픈/진행중 이슈 목록 반환
        - user_id 지정 시 해당 담당자 이슈 필터링
        - unassigned=True 시 미할당 이슈 반환
        - 기존 프로젝트 이슈 캐시(issues:{project_id})를 재사용하여 추가 API 호출 없음
        """
        pid = project_id or self._settings.dashboard.default_project
        all_issues = await self._fetch_project_issues(pid)

        today = date.today()
        closed_ids = self._settings.get_excluded_status_ids(("closed",))
        base_url = self._client.base_url

        issues = []
        overdue_count = 0
        target_name = "미할당"

        for issue in all_issues:
            status_id = issue.get("status", {}).get("id")

            # closed 그룹 제외 — 오픈/진행중만 포함
            if status_id in closed_ids:
                continue

            assigned = issue.get("assigned_to")
            assigned_id = assigned.get("id") if assigned else None
            assigned_name = assigned.get("name") if assigned else "미할당"

            # 담당자 필터링
            if unassigned:
                if assigned_id is not None:
                    continue
            else:
                if assigned_id != user_id:
                    continue
                target_name = assigned_name

            # 기한 초과 계산
            due_str = issue.get("due_date")
            is_overdue, days_overdue = calc_overdue(due_str, today)
            if is_overdue:
                overdue_count += 1

            issues.append({
                "id": issue["id"],
                "subject": issue.get("subject", ""),
                "status": issue.get("status", {}).get("name", ""),
                "priority": issue.get("priority", {}).get("name"),
                "due_date": due_str,
                "is_overdue": is_overdue,
                "days_overdue": days_overdue,
                "url": f"{base_url}/issues/{issue['id']}",
            })

        # 기한초과 이슈 상단, 나머지는 마감일 순
        issues.sort(key=lambda x: (-x["days_overdue"], x["due_date"] or "9999-12-31"))

        return {
            "project_id": pid,
            "user_id": None if unassigned else user_id,
            "user_name": target_name,
            "total": len(issues),
            "overdue_count": overdue_count,
            "issues": issues,
            "cached_at": datetime.now(),
        }
  