"""
schemas/dashboard.py — 대시보드 API 응답 Pydantic 모델
"""
from datetime import datetime

from pydantic import BaseModel, Field


class StatusGroupCount(BaseModel):
    """상태 그룹별 이슈 수"""
    open: int = 0
    in_progress: int = 0
    closed: int = 0


class DashboardSummary(BaseModel):
    """GET /api/v1/dashboard/summary 응답"""
    project_id: str
    total: int
    by_status_group: dict[str, int]
    overdue: int
    cached_at: datetime


class ProjectIssueCount(BaseModel):
    """프로젝트별 이슈 수"""
    id: str
    name: str
    open_issues: int = 0
    overdue_issues: int = 0
    stale_issues: int = 0
    unassigned_issues: int = 0
    high_priority_issues: int = 0
    due_soon_issues: int = 0
    risk_score: int = 0
    risk_level: str = "stable"
    primary_reason: str = "활성 작업량 기준으로 먼저 볼 수 있는 프로젝트"


class ProjectListResponse(BaseModel):
    """GET /api/v1/dashboard/projects 응답"""
    projects: list[ProjectIssueCount]
    cached_at: datetime


class OverdueIssueItem(BaseModel):
    """기한 초과 이슈 항목"""
    id: int
    subject: str
    due_date: str
    assigned_to: str | None = None
    status: str
    priority: str | None = None
    days_overdue: int
    url: str


class OverdueIssuesResponse(BaseModel):
    """GET /api/v1/dashboard/issues/overdue 응답"""
    project_id: str
    count: int
    issues: list[OverdueIssueItem]
    cached_at: datetime


class WorkloadItem(BaseModel):
    """담당자별 워크로드 항목"""
    user_id: int | None = None
    name: str
    open_issues: int = 0
    overdue_issues: int = 0


class WorkloadResponse(BaseModel):
    """GET /api/v1/dashboard/workload 응답"""
    project_id: str
    workload: list[WorkloadItem]
    cached_at: datetime


# ── 담당자별 이슈 상세 ──

class IssueListItem(BaseModel):
    """전체 이슈 목록 항목"""
    id: int
    subject: str
    status: str
    status_group: str
    priority: str | None = None
    assigned_to: str | None = None
    assigned_to_id: int | None = None
    author: str | None = None
    tracker: str | None = None
    due_date: str | None = None
    created_on: str | None = None
    updated_on: str | None = None
    done_ratio: int = 0
    is_overdue: bool = False
    days_overdue: int = 0
    is_due_soon: bool = False
    days_until_due: int | None = None
    is_stale: bool = False
    days_since_update: int | None = None
    url: str


class IssueListResponse(BaseModel):
    """GET /api/v1/dashboard/issues 응답"""
    project_id: str
    total: int
    issues: list[IssueListItem]
    cached_at: datetime


class MemberIssueItem(BaseModel):
    """담당자별 이슈 항목 (오픈/진행중 전체)"""
    id: int
    subject: str
    status: str
    priority: str | None = None
    due_date: str | None = None
    is_overdue: bool = False
    days_overdue: int = 0
    url: str


class MemberIssuesResponse(BaseModel):
    """GET /api/v1/dashboard/workload/member 응답"""
    project_id: str
    user_id: int | None = None
    user_name: str
    total: int
    overdue_count: int
    issues: list[MemberIssueItem]
    cached_at: datetime


# ── 이슈 상세 ──

class JournalChange(BaseModel):
    """변경 이력 내 필드 변경"""
    field: str
    property: str = ""
    old_value: str | None = None
    new_value: str | None = None


class JournalEntry(BaseModel):
    """변경 이력 (저널) 항목"""
    id: int | None = None
    user: str = ""
    created_on: str = ""
    notes: str | None = None
    notes_html: str | None = None
    changes: list[JournalChange] = Field(default_factory=list)


class IssueAttachment(BaseModel):
    """이슈 첨부파일 항목"""
    id: int
    filename: str
    filesize: int | None = None
    content_type: str | None = None
    content_url: str


class RelatedIssueItem(BaseModel):
    """이슈 상세의 관련 이슈 항목"""
    id: int
    label: str
    relation_type: str = "related"
    url: str


class IssueDetailResponse(BaseModel):
    """GET /api/v1/dashboard/issues/{issue_id} 응답"""
    id: int
    subject: str
    description: str | None = None
    description_html: str | None = None
    status: str
    status_id: int | None = None
    status_group: str = "other"
    priority: str | None = None
    assigned_to: str | None = None
    assigned_to_id: int | None = None
    author: str | None = None
    tracker: str | None = None
    category: str | None = None
    version: str | None = None
    start_date: str | None = None
    due_date: str | None = None
    done_ratio: int = 0
    created_on: str | None = None
    updated_on: str | None = None
    url: str
    redmine_base_url: str = ""
    attachments: list[IssueAttachment] = Field(default_factory=list)
    journals: list[JournalEntry] = Field(default_factory=list)
    related_issues: list[RelatedIssueItem] = Field(default_factory=list)
