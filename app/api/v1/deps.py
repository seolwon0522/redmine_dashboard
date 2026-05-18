"""
api/v1/deps.py - FastAPI 의존성 주입 헬퍼.
"""

from fastapi import Request

from app.client.redmine_client import RedmineClient
from app.services.issue_service import IssueService
from app.services.project_service import ProjectService
from app.services.redmine_connection_service import RedmineConnectionService
from app.services.workload_service import WorkloadService


def get_issue_service(request: Request) -> IssueService:
    return request.app.state.issue_service


def get_redmine_client(request: Request) -> RedmineClient:
    return request.app.state.redmine_client


def get_redmine_connection_service(request: Request) -> RedmineConnectionService:
    return request.app.state.redmine_connection_service


def get_project_service(request: Request) -> ProjectService:
    return request.app.state.project_service


def get_workload_service(request: Request) -> WorkloadService:
    return request.app.state.workload_service
