"""위키 오프라인 export 엔드포인트."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime
from pathlib import Path
from urllib.parse import quote

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import FileResponse

from app.services.wiki_export_jobs import ExportJob, ExportJobStore
from app.services.wiki_export_service import WikiExportService

logger = logging.getLogger(__name__)

MAX_JOB_LOG_ENTRIES = 200
CLEANUP_INTERVAL_SECONDS = 60

router = APIRouter(prefix="/wiki-export", tags=["wiki-export"])


def _append_job_log(job: ExportJob, message: str, progress: int | None = None, step: str | None = None) -> None:
    timestamp = datetime.now().strftime("%H:%M:%S")
    job.logs.append(f"[{timestamp}] {message}")
    if len(job.logs) > MAX_JOB_LOG_ENTRIES:
        del job.logs[:-MAX_JOB_LOG_ENTRIES]
    job.updated_at = datetime.now().isoformat()
    if progress is not None:
        job.progress = max(0, min(100, progress))
    if step is not None:
        job.step = step


async def _cleanup_expired_jobs_forever(request_app) -> None:
    store: ExportJobStore = request_app.state.export_job_store
    while True:
        await asyncio.sleep(CLEANUP_INTERVAL_SECONDS)
        cleaned_jobs = store.cleanup_expired()
        if cleaned_jobs:
            logger.info("wiki export periodic cleanup removed_jobs=%s", cleaned_jobs)


def _ensure_cleanup_task(request_app) -> None:
    cleanup_task = getattr(request_app.state, "wiki_export_cleanup_task", None)
    if cleanup_task is not None and not cleanup_task.done():
        return
    request_app.state.wiki_export_cleanup_task = asyncio.create_task(_cleanup_expired_jobs_forever(request_app))


async def _run_export_job(request_app, job_id: str) -> None:
    store: ExportJobStore = request_app.state.export_job_store
    service: WikiExportService = request_app.state.wiki_export_service
    job = store.get(job_id)
    if job is None:
        return

    job.state = "running"
    _append_job_log(job, "위키 export 작업을 시작했습니다.", progress=2, step="초기화")

    try:
        bundle = await service.export_project_wiki_bundle(
            job.project_key,
            on_progress=lambda message, progress=None, step=None: _append_job_log(job, message, progress, step),
        )
        output_path, output_size_bytes = store.save_output_file(
            job.id,
            job.project_key,
            bundle.content,
            bundle.filename,
            bundle.media_type,
        )
        del bundle

        job.state = "completed"
        job.finished_at = datetime.now().isoformat()
        job.output_path = output_path
        job.output_size_bytes = output_size_bytes
        logger.info(
            "wiki export completed: job_id=%s project=%s path=%s size_bytes=%s",
            job.id,
            job.project_key,
            output_path,
            output_size_bytes,
        )
        _append_job_log(job, "오프라인 ZIP 번들 생성이 완료되었습니다. 다운로드를 준비합니다.", progress=100, step="완료")
    except Exception as exc:
        logger.exception("wiki export job failed: %s", job.project_key)
        job.state = "failed"
        job.error = str(exc)
        job.finished_at = datetime.now().isoformat()
        _append_job_log(job, f"작업이 실패했습니다: {exc}", step="실패")


@router.post("/jobs")
async def create_export_job(request: Request, project_key: str = Query(..., min_length=1)):
    store: ExportJobStore = request.app.state.export_job_store
    _ensure_cleanup_task(request.app)
    cleaned_jobs = store.cleanup_expired()
    if cleaned_jobs:
        logger.info("wiki export cleanup before create: removed_jobs=%s", cleaned_jobs)

    job = store.create(project_key)
    _append_job_log(job, f"{project_key} 위키 문서 export 작업을 생성했습니다.", progress=0, step="대기")
    asyncio.create_task(_run_export_job(request.app, job.id))
    return job.to_dict()


@router.get("/jobs/{job_id}")
async def get_export_job_status(request: Request, job_id: str):
    store: ExportJobStore = request.app.state.export_job_store
    _ensure_cleanup_task(request.app)
    store.cleanup_expired()
    job = store.get(job_id)
    if job is None:
        now = datetime.now().isoformat()
        return {
            "id": job_id,
            "project_key": "",
            "state": "failed",
            "progress": 100,
            "step": "작업 정보를 찾을 수 없음",
            "logs": [],
            "error": "Wiki export job not found.",
            "created_at": now,
            "updated_at": now,
            "finished_at": now,
            "download_ready": False,
            "downloaded": True,
        }
    return job.to_dict()


@router.get("/jobs/{job_id}/download")
async def download_export_result(request: Request, job_id: str):
    store: ExportJobStore = request.app.state.export_job_store
    _ensure_cleanup_task(request.app)
    store.cleanup_expired()
    job = store.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Wiki export job not found.")
    if job.state != "completed" or job.output_path is None:
        raise HTTPException(status_code=409, detail="Wiki export job is not ready for download.")
    if not Path(job.output_path).exists():
        raise HTTPException(status_code=410, detail="Wiki export result file was expired or removed.")

    filename = job.output_filename or f"{job.project_key}-wiki-export.zip"
    quoted_filename = quote(filename)
    job.downloaded = True
    _append_job_log(job, "다운로드 요청을 처리했습니다.")

    return FileResponse(
        path=job.output_path,
        media_type=job.output_media_type or "application/octet-stream",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quoted_filename}"},
    )
