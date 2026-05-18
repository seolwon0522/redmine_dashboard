"""Redmine 연결 설정 엔드포인트."""

from fastapi import APIRouter, Depends

from app.api.v1.deps import get_redmine_connection_service
from app.schemas.redmine_connection import (
    RedmineConnectionDeleteResponse,
    RedmineConnectionRequest,
    RedmineConnectionSaveResponse,
    RedmineConnectionStatusResponse,
    RedmineConnectionTestResponse,
)
from app.services.redmine_connection_service import RedmineConnectionService

router = APIRouter(prefix="/redmine", tags=["redmine"])


@router.get("/connection-status", response_model=RedmineConnectionStatusResponse)
async def get_connection_status(
    service: RedmineConnectionService = Depends(get_redmine_connection_service),
):
    return await service.get_connection_status()


@router.post("/test-connection", response_model=RedmineConnectionTestResponse)
async def test_connection(
    payload: RedmineConnectionRequest,
    service: RedmineConnectionService = Depends(get_redmine_connection_service),
):
    return await service.test_connection(payload)


@router.post("/save-connection", response_model=RedmineConnectionSaveResponse)
async def save_connection(
    payload: RedmineConnectionRequest,
    service: RedmineConnectionService = Depends(get_redmine_connection_service),
):
    return await service.save_connection(payload)


@router.delete("/connection", response_model=RedmineConnectionDeleteResponse)
async def clear_connection(
    service: RedmineConnectionService = Depends(get_redmine_connection_service),
):
    return await service.clear_connection()
