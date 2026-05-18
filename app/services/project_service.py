"""
services/project_service.py — 프로젝트 목록 + 이슈 수 집계
N+1 방지: 이슈를 한 번 조회 후 project.id로 groupby
"""
from collections import defaultdict
from datetime import date, datetime

from app.client.redmine_client import RedmineClient
from app.core.cache import TTLCache
from app.core.config import Settings
from app.services.utils import calc_overdue

HIGH_PRIORITY_NAMES = {'Immediate', 'Urgent', 'High'}
ENTRY_STALE_DAYS = 7
ENTRY_DUE_SOON_DAYS = 3


def _parse_api_date(value: str | None) -> date | None:
    if not value:
        return None

    try:
        return date.fromisoformat(value[:10])
    except ValueError:
        return None


def _build_primary_reason(metrics: dict[str, int]) -> str:
    weighted_reasons = [
        ('지연 작업', metrics['overdue_issues'] * 6),
        ('업데이트 정체', metrics['stale_issues'] * 4),
        ('담당 미지정', metrics['unassigned_issues'] * 3),
        ('임박 일정', metrics['due_soon_issues'] * 2),
        ('높은 우선순위', metrics['high_priority_issues'] * 2),
        ('활성 작업량', metrics['open_issues']),
    ]

    label, weighted_score = max(weighted_reasons, key=lambda item: item[1])
    if weighted_score <= 0:
        return '활성 작업량 기준으로 먼저 볼 수 있는 프로젝트'

    if label == '활성 작업량':
        return f'활성 작업 {metrics["open_issues"]}건이 열려 있습니다'

    count_key = {
        '지연 작업': 'overdue_issues',
        '업데이트 정체': 'stale_issues',
        '담당 미지정': 'unassigned_issues',
        '임박 일정': 'due_soon_issues',
        '높은 우선순위': 'high_priority_issues',
    }[label]
    return f'{label} {metrics[count_key]}건이 먼저 확인 대상으로 보입니다'


def _build_risk_level(score: int) -> str:
    if score >= 24:
        return 'critical'
    if score >= 10:
        return 'warning'
    return 'stable'


class ProjectService:
    """프로젝트 관련 서비스"""

    def __init__(self, client: RedmineClient, cache: TTLCache, settings: Settings):
        self._client = client
        self._cache = cache
        self._settings = settings

    async def get_project_list(self) -> dict:
        """
        프로젝트 목록 + 각 프로젝트의 open 이슈 수 반환
        프로젝트 목록은 Redmine API 1회, 이슈 목록은 별도 1회 조회 후 집계
        """
        cache_key = "projects:list"

        async def _factory():
            # 프로젝트 목록 조회
            projects = await self._client.fetch_projects()
            today = date.today()

            # 전체 이슈 조회 (open 상태 그룹만)
            open_ids = self._settings.dashboard.status_groups.get("open", [])
            in_progress_ids = self._settings.dashboard.status_groups.get("in_progress", [])
            active_ids = open_ids + in_progress_ids

            # open + in_progress 상태의 이슈를 한 번에 조회
            all_issues = await self._client.fetch_all_issues({
                "status_id": "|".join(str(sid) for sid in active_ids) if active_ids else "*",
            })

            # 프로젝트별 운영 위험 신호 집계
            issue_counts: dict[int, dict[str, int]] = defaultdict(lambda: {
                'open_issues': 0,
                'overdue_issues': 0,
                'stale_issues': 0,
                'unassigned_issues': 0,
                'high_priority_issues': 0,
                'due_soon_issues': 0,
                'risk_score': 0,
            })
            for issue in all_issues:
                proj_id = issue.get("project", {}).get("id")
                if proj_id is not None:
                    metrics = issue_counts[proj_id]
                    metrics['open_issues'] += 1

                    due_date = issue.get('due_date')
                    updated_on = _parse_api_date(issue.get('updated_on'))
                    assigned = issue.get('assigned_to')
                    priority_name = (issue.get('priority') or {}).get('name')

                    is_overdue, days_overdue = calc_overdue(due_date, today)
                    if is_overdue:
                        metrics['overdue_issues'] += 1
                        metrics['risk_score'] += 6 + min(days_overdue, 10)
                    else:
                        parsed_due_date = _parse_api_date(due_date)
                        if parsed_due_date is not None:
                            days_until_due = (parsed_due_date - today).days
                            if 0 <= days_until_due <= ENTRY_DUE_SOON_DAYS:
                                metrics['due_soon_issues'] += 1
                                metrics['risk_score'] += 2

                    if updated_on is not None and (today - updated_on).days >= ENTRY_STALE_DAYS:
                        metrics['stale_issues'] += 1 
                        metrics['risk_score'] += 4

                    if assigned is None:
                        metrics['unassigned_issues'] += 1
                        metrics['risk_score'] += 3

                    if priority_name in HIGH_PRIORITY_NAMES:
                        metrics['high_priority_issues'] += 1
                        metrics['risk_score'] += 2

            result = []
            for proj in projects:
                metrics = issue_counts.get(proj.get('id', 0), {
                    'open_issues': 0,
                    'overdue_issues': 0,
                    'stale_issues': 0,
                    'unassigned_issues': 0,
                    'high_priority_issues': 0,
                    'due_soon_issues': 0,
                    'risk_score': 0,
                })
                result.append({
                    "id": proj.get("identifier", ""),
                    "name": proj.get("name", ""),
                    "open_issues": metrics['open_issues'],
                    "overdue_issues": metrics['overdue_issues'],
                    "stale_issues": metrics['stale_issues'],
                    "unassigned_issues": metrics['unassigned_issues'],
                    "high_priority_issues": metrics['high_priority_issues'],
                    "due_soon_issues": metrics['due_soon_issues'],
                    "risk_score": metrics['risk_score'],
                    "risk_level": _build_risk_level(metrics['risk_score']),
                    "primary_reason": _build_primary_reason(metrics),
                })

            return result

        projects = await self._cache.get_or_set(
            cache_key,
            _factory,
            ttl=self._settings.dashboard.cache_ttl_seconds,
        )

        return {
            "projects": projects,
            "cached_at": datetime.now(),
        }
