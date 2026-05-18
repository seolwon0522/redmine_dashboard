"""위키 export 작업 상태 저장소."""

from __future__ import annotations

import logging
import os
import re
import tempfile
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from threading import Lock
from typing import Literal
from uuid import uuid4

JobState = Literal["queued", "running", "completed", "failed"]

logger = logging.getLogger(__name__)


@dataclass
class ExportJob:
    id: str
    project_key: str
    state: JobState = "queued"
    progress: int = 0
    step: str = "작업 대기 중"
    logs: list[str] = field(default_factory=list)
    output_path: str | None = None
    output_filename: str | None = None
    output_media_type: str | None = None
    output_size_bytes: int | None = None
    error: str | None = None
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now().isoformat())
    finished_at: str | None = None
    downloaded: bool = False

    def to_dict(self) -> dict[str, object]:
        return {
            "id": self.id,
            "project_key": self.project_key,
            "state": self.state,
            "progress": self.progress,
            "step": self.step,
            "logs": self.logs[-12:],
            "error": self.error,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "finished_at": self.finished_at,
            "download_ready": self.output_path is not None,
            "downloaded": self.downloaded,
        }


class ExportJobStore:
    def __init__(self, completed_ttl_seconds: int = 1800, failed_ttl_seconds: int = 1800) -> None:
        self._jobs: dict[str, ExportJob] = {}
        self._completed_ttl_seconds = completed_ttl_seconds
        self._failed_ttl_seconds = failed_ttl_seconds
        self._output_dir = Path(tempfile.gettempdir()) / "dashboard-wiki-exports"
        self._output_dir.mkdir(parents=True, exist_ok=True)
        self._lock = Lock()

    def create(self, project_key: str) -> ExportJob:
        with self._lock:
            self._cleanup_expired_locked()
            job = ExportJob(id=uuid4().hex, project_key=project_key)
            self._jobs[job.id] = job
            return job

    def save_output_file(
        self,
        job_id: str,
        project_key: str,
        file_bytes: bytes,
        output_filename: str,
        output_media_type: str,
    ) -> tuple[str, int]:
        safe_project_key = re.sub(r"[^A-Za-z0-9._-]+", "_", project_key).strip("_") or "project"
        suffix = Path(output_filename).suffix or ".bin"
        file_path = self._output_dir / f"{safe_project_key}-{job_id}{suffix}"

        file_path.write_bytes(file_bytes)
        size_bytes = file_path.stat().st_size

        with self._lock:
            job = self._jobs.get(job_id)
            if job is not None:
                job.output_path = str(file_path)
                job.output_filename = output_filename
                job.output_media_type = output_media_type
                job.output_size_bytes = size_bytes
                job.updated_at = datetime.now().isoformat()

        return str(file_path), size_bytes

    def cleanup_expired(self) -> int:
        with self._lock:
            return self._cleanup_expired_locked()

    def get(self, job_id: str) -> ExportJob | None:
        with self._lock:
            self._cleanup_expired_locked()
            return self._jobs.get(job_id)

    def _cleanup_expired_locked(self) -> int:
        now = datetime.now()
        expired_job_ids: list[str] = []

        for job_id, job in self._jobs.items():
            if job.state not in ("completed", "failed") or not job.finished_at:
                continue

            finished_at = datetime.fromisoformat(job.finished_at)
            elapsed_seconds = (now - finished_at).total_seconds()
            ttl_seconds = self._completed_ttl_seconds if job.state == "completed" else self._failed_ttl_seconds
            if elapsed_seconds >= ttl_seconds:
                expired_job_ids.append(job_id)

        for job_id in expired_job_ids:
            job = self._jobs.pop(job_id)
            if job.output_path:
                try:
                    os.remove(job.output_path)
                    logger.info(
                        "wiki export cleanup removed file: job_id=%s path=%s size_bytes=%s",
                        job.id,
                        job.output_path,
                        job.output_size_bytes,
                    )
                except FileNotFoundError:
                    logger.info("wiki export cleanup file already removed: job_id=%s path=%s", job.id, job.output_path)
                except OSError as exc:
                    logger.warning(
                        "wiki export cleanup failed to delete file: job_id=%s path=%s error=%s",
                        job.id,
                        job.output_path,
                        exc,
                    )

            logger.info("wiki export cleanup removed expired job: job_id=%s state=%s", job.id, job.state)

        return len(expired_job_ids)
