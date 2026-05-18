"""
api/v1/router.py — v1 API 라우터 통합
모든 v1 하위 라우터를 하나로 묶어 main.py에서 include
"""
from fastapi import APIRouter

from app.api.v1.analytics import router as analytics_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.redmine import router as redmine_router
from app.api.v1.wiki_export import router as wiki_export_router

# v1 접두사를 가진 상위 라우터
router = APIRouter(prefix="/api/v1")
router.include_router(dashboard_router)
router.include_router(analytics_router)
router.include_router(redmine_router)
router.include_router(wiki_export_router)
