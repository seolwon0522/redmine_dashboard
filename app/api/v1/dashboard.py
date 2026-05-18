"""
api/v1/dashboard.py — 대시보드 엔드포인트
/api/v1/dashboard/* 하위 엔드포인트 구현
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel

from app.api.v1.deps import get_issue_service, get_project_service, get_redmine_client, get_workload_service
from app.client.redmine_client import RedmineClient
from app.schemas.dashboard import (
    DashboardSummary,
    IssueDetailResponse,
    IssueListResponse,
    MemberIssuesResponse,
    OverdueIssuesResponse,
    ProjectListResponse,
    WorkloadResponse,
)
from app.services.issue_service import IssueService
from app.services.project_service import ProjectService
from app.services.workload_service import WorkloadService

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummary)
async def get_summary(
    project_id: str | None = Query(None, description="프로젝트 ID (미지정 시 config 기본값)"),
    service: IssueService = Depends(get_issue_service),
):
    """대시보드 요약: 전체/상태그룹별 이슈 수, 기한초과 수"""
    return await service.get_summary(project_id)


@router.get("/projects", response_model=ProjectListResponse)
async def get_projects(
    service: ProjectService = Depends(get_project_service),
):
    """프로젝트 목록 + 각 프로젝트 open 이슈 수"""
    return await service.get_project_list()


@router.get("/issues/overdue", response_model=OverdueIssuesResponse)
async def get_overdue_issues(
    project_id: str | None = Query(None, description="프로젝트 ID (미지정 시 config 기본값)"),
    service: IssueService = Depends(get_issue_service),
):
    """기한 초과 이슈 목록 (초과일 기준 내림차순)"""
    return await service.get_overdue_issues(project_id)


@router.get("/issues", response_model=IssueListResponse)
async def get_all_issues(
    project_id: str | None = Query(None, description="프로젝트 ID (미지정 시 config 기본값)"),
    service: IssueService = Depends(get_issue_service),
):
    """전체 이슈 목록 (상태 그룹, 담당자, 마감일, 기한 초과 여부 포함)"""
    return await service.get_all_issues(project_id)


@router.get("/issues/{issue_id}", response_model=IssueDetailResponse)
async def get_issue_detail(
    issue_id: int,
    service: IssueService = Depends(get_issue_service),
):
    """단일 이슈 상세 + 변경 이력(journals) 조회"""
    return await service.get_issue_detail(issue_id)


@router.get("/workload", response_model=WorkloadResponse)
async def get_workload(
    project_id: str | None = Query(None, description="프로젝트 ID (미지정 시 config 기본값)"),
    service: WorkloadService = Depends(get_workload_service),
):
    """담당자별 워크로드: open 이슈 수 + overdue 이슈 수"""
    return await service.get_workload(project_id)


@router.get("/workload/member", response_model=MemberIssuesResponse)
async def get_member_issues(
    user_id: int | None = Query(None, description="담당자 ID (미지정 시 unassigned 파라미터 확인)"),
    unassigned: bool = Query(False, description="True면 미할당 이슈만 반환"),
    project_id: str | None = Query(None, description="프로젝트 ID (미지정 시 config 기본값)"),
    service: WorkloadService = Depends(get_workload_service),
):
    """담당자별 오픈/진행중 이슈 상세 목록"""
    return await service.get_member_issues(
        user_id=user_id,
        unassigned=unassigned,
        project_id=project_id,
    )


@router.get("/assets")
async def proxy_redmine_asset(
    url: str = Query(..., description="Redmine asset absolute URL"),
    client: RedmineClient = Depends(get_redmine_client),
):
    """Redmine 보호 리소스를 현재 연결 설정으로 프록시"""
    try:
        response = await client.fetch_asset(url)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    headers: dict[str, str] = {}
    content_disposition = response.headers.get("content-disposition")
    cache_control = response.headers.get("cache-control")
    if content_disposition:
        headers["content-disposition"] = content_disposition
    if cache_control:
        headers["cache-control"] = cache_control

    return Response(
        content=response.content,
        media_type=response.headers.get("content-type", "application/octet-stream"),
        headers=headers,
    )

class UpdateIssueStatusRequest(BaseModel):
    status_id: int

@router.put("/issues/{issue_id}")
async def update_issue_status(
    issue_id: int,
    request: UpdateIssueStatusRequest,
    project_id: str | None = Query(None, description="프로젝트 ID"),
    service: IssueService = Depends(get_issue_service),
):
    """이슈 상태 업데이트"""
    await service.update_issue_status(issue_id, request.status_id, project_id)
    return {"status": "ok"}
