"""
main.py — FastAPI 앱 진입점
lifespan 이벤트로 httpx.AsyncClient 생성/정리, 서비스 객체 초기화
"""
import logging
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.requests import Request
from fastapi.responses import JSONResponse

from app.api.v1.router import router as v1_router
from app.client.redmine_client import (
    RedmineAuthenticationError,
    RedmineClient,
    RedmineConnectionError,
    RedmineNotConfiguredError,
    RedmineResponseError,
    RedmineTimeoutError,
)
from app.core.cache import TTLCache
from app.core.connection_store import RedmineConnectionStore
from app.core.config import get_settings
from app.services.issue_service import IssueService
from app.services.project_service import ProjectService
from app.services.redmine_connection_service import RedmineConnectionService
from app.services.wiki_export_jobs import ExportJobStore
from app.services.wiki_export_service import WikiExportService
from app.services.workload_service import WorkloadService

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """앱 시작/종료 시 리소스 관리"""
    settings = get_settings()
    logger.info("설정 로드 완료: project=%s", settings.dashboard.default_project)

    # httpx AsyncClient 생성 (커넥션 풀 최적화)
    # - max_connections: 동시 연결 제한 (메모리 절감)
    # - max_keepalive_connections: 연결 재사용 풀 크기
    # - timeout: 전체 요청 타임아웃 (기본 5초)
    limits = httpx.Limits(
        max_connections=10,
        max_keepalive_connections=5,
        keepalive_expiry=30.0,
    )
    timeout = httpx.Timeout(5.0)
    http_client = httpx.AsyncClient(limits=limits, timeout=timeout)

    # 인메모리 TTL 캐시 생성 (LRU 정책 포함)
    # max_size: 최대 1000개 항목 저장 (메모리 제한)
    cache = TTLCache(
        default_ttl=settings.dashboard.cache_ttl_seconds,
        max_size=1000,
    )

    # Redmine 연결 저장소 생성
    connection_store = RedmineConnectionStore(settings)
    app.state.redmine_connection_store = connection_store

    # Redmine 클라이언트 생성
    redmine_client = RedmineClient(connection_provider=connection_store.get_connection, http_client=http_client)
    app.state.redmine_client = redmine_client
    app.state.redmine_connection_service = RedmineConnectionService(
        store=connection_store,
        client=redmine_client,
        cache=cache,
    )
    app.state.wiki_export_service = WikiExportService(redmine_client)
    app.state.export_job_store = ExportJobStore()

    # 서비스 객체 생성 → app.state에 저장
    app.state.issue_service = IssueService(client=redmine_client, cache=cache, settings=settings)
    app.state.project_service = ProjectService(client=redmine_client, cache=cache, settings=settings)
    app.state.workload_service = WorkloadService(client=redmine_client, cache=cache, settings=settings)
    app.state.cache = cache

    logger.info("서비스 초기화 완료. 서버 시작 (redmine_source=%s)", connection_store.get_source())

    yield

    # 종료 시 httpx 클라이언트 정리
    await http_client.aclose()
    logger.info("httpx 클라이언트 종료 완료")


app = FastAPI(
    title="Redmine Dashboard API",
    description="Redmine REST API 기반 대시보드 백엔드 (DB 미사용, 인메모리 캐시)",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS 설정 (프론트엔드 연동용)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 운영 시 구체적인 도메인으로 제한 권장
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# v1 API 라우터 등록
app.include_router(v1_router)


# ── Redmine API 관련 글로벌 예외 핸들러 ──

@app.exception_handler(RedmineNotConfiguredError)
async def redmine_not_configured_handler(request: Request, exc: RedmineNotConfiguredError):
    return JSONResponse(
        status_code=503,
        content={"detail": "Redmine connection is not configured."},
    )


@app.exception_handler(RedmineAuthenticationError)
async def redmine_auth_error_handler(request: Request, exc: RedmineAuthenticationError):
    return JSONResponse(
        status_code=502,
        content={"detail": "Redmine authentication failed."},
    )


@app.exception_handler(RedmineResponseError)
async def redmine_http_error_handler(request: Request, exc: RedmineResponseError):
    """Redmine API가 4xx/5xx 응답을 반환한 경우 502로 변환"""
    logger.error("Redmine API 오류: %s", exc.status_code)
    return JSONResponse(
        status_code=502,
        content={"detail": f"Redmine server error ({exc.status_code})"},
    )


async def _redmine_connect_error_response() -> JSONResponse:
    return JSONResponse(
        status_code=502,
        content={"detail": "Unable to reach the Redmine server."},
    )


@app.exception_handler(RedmineConnectionError)
async def redmine_connect_error_handler(request: Request, exc: RedmineConnectionError):
    """Redmine 서버 연결 실패 시 502 반환"""
    logger.error("Redmine 연결 실패")
    return await _redmine_connect_error_response()


@app.exception_handler(RedmineTimeoutError)
async def redmine_timeout_error_handler(request: Request, exc: RedmineTimeoutError):
    """Redmine 응답 지연 시 502 반환"""
    logger.error("Redmine 응답 지연")
    return await _redmine_connect_error_response()


@app.get("/health", tags=["system"])
async def health_check():
    """헬스체크 엔드포인트"""
    return {"status": "ok"}
