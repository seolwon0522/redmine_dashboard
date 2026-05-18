"""
core/config.py — config.json 로드 및 설정 객체 관리
"""
import json
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path


@dataclass(frozen=True)
class RedmineConfig:
    """Redmine 서버 연결 설정"""

    base_url: str
    auth_type: str = "api_key"
    api_key: str | None = None
    username: str | None = None
    password: str | None = None
    timeout: int = 30
    retry_attempts: int = 3
    page_size: int = 100


@dataclass(frozen=True)
class OverdueRule:
    """기한 초과 판단 규칙"""
    field: str = "due_date"
    exclude_status_groups: tuple[str, ...] = ("closed",)


@dataclass(frozen=True)
class DashboardConfig:
    """대시보드 관련 설정"""
    default_project: str
    include_subprojects: bool = False
    cache_ttl_seconds: int = 300
    # 상태 그룹: {"open": [1,2], "in_progress": [3,4], "closed": [5,6,7]}
    status_groups: dict[str, list[int]] = field(default_factory=dict)
    overdue_rule: OverdueRule = field(default_factory=OverdueRule)


@dataclass(frozen=True)
class Settings:
    """전체 애플리케이션 설정"""

    redmine: RedmineConfig | None = None
    dashboard: DashboardConfig = field(default_factory=lambda: DashboardConfig(default_project=""))

    def get_status_group(self, status_id: int) -> str | None:
        """상태 ID를 받아 소속 그룹명 반환. 미매핑 시 None"""
        for group_name, ids in self.dashboard.status_groups.items():
            if status_id in ids:
                return group_name
        return None

    def get_excluded_status_ids(self, exclude_groups: tuple[str, ...] | list[str]) -> set[int]:
        """제외할 상태 그룹명 목록을 받아 해당 상태 ID 집합 반환"""
        excluded: set[int] = set()
        for group_name in exclude_groups:
            excluded.update(self.dashboard.status_groups.get(group_name, []))
        return excluded


def _parse_redmine_config(raw: dict | None) -> RedmineConfig | None:
    if not raw:
        return None

    return RedmineConfig(
        base_url=(raw.get("base_url") or "").rstrip("/"),
        auth_type=raw.get("auth_type", "api_key"),
        api_key=raw.get("api_key"),
        username=raw.get("username"),
        password=raw.get("password"),
        timeout=raw.get("timeout", 30),
        retry_attempts=raw.get("retry_attempts", 3),
        page_size=raw.get("page_size", 100),
    )


def _parse_config(raw: dict) -> Settings:
    """원본 dict를 Settings 객체로 변환"""
    redmine = _parse_redmine_config(raw.get("redmine"))
    dash_raw = raw["dashboard"]

    overdue_raw = dash_raw.get("overdue_rule", {})
    overdue_rule = OverdueRule(
        field=overdue_raw.get("field", "due_date"),
        exclude_status_groups=tuple(overdue_raw.get("exclude_status_groups", ["closed"])),
    )

    dashboard = DashboardConfig(
        default_project=dash_raw["default_project"],
        include_subprojects=dash_raw.get("include_subprojects", False),
        cache_ttl_seconds=dash_raw.get("cache_ttl_seconds", 300),
        status_groups=dash_raw.get("status_groups", {}),
        overdue_rule=overdue_rule,
    )

    return Settings(redmine=redmine, dashboard=dashboard)


# config.json 파일 경로: 프로젝트 루트 기준
_CONFIG_PATH = Path(__file__).resolve().parent.parent.parent / "config.json"


@lru_cache
def get_settings() -> Settings:
    """config.json을 읽어 Settings 싱글턴 반환. 앱 시작 시 1회만 실행"""
    if not _CONFIG_PATH.exists():
        raise FileNotFoundError(f"설정 파일을 찾을 수 없습니다: {_CONFIG_PATH}")

    with open(_CONFIG_PATH, encoding="utf-8") as f:
        raw = json.load(f)

    # 필수 키 검증
    if "dashboard" not in raw:
        raise KeyError("config.json에 'dashboard' 섹션이 없습니다")

    return _parse_config(raw)
