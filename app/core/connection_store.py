"""Redmine 연결 정보 로드/저장 계층."""

import json
import os
from pathlib import Path

from app.core.config import RedmineConfig, Settings

_RUNTIME_CONFIG_PATH = Path(__file__).resolve().parent.parent.parent / "config.runtime.json"


class RedmineConnectionStore:
    """Redmine 연결 정보를 환경 변수, 로컬 파일, 레거시 config 순서로 조회한다."""

    def __init__(self, settings: Settings):
        self._settings = settings
        self._runtime_path = _RUNTIME_CONFIG_PATH
        self._runtime_defaults = self._build_runtime_defaults(settings.redmine)
        self._connection, self._source = self._load_current()

    def get_connection(self) -> RedmineConfig | None:
        return self._connection

    def get_source(self) -> str:
        return self._source

    def get_runtime_defaults(self) -> RedmineConfig:
        return self._runtime_defaults

    def can_persist(self) -> bool:
        return self._source != "environment"

    def clear_connection(self) -> None:
        if not self.can_persist():
            raise RuntimeError("Environment-managed Redmine settings cannot be cleared from the UI.")

        payload = {
            "redmine": {
                "disabled": True,
            }
        }
        self._runtime_path.write_text(
            json.dumps(payload, ensure_ascii=True, indent=2),
            encoding="utf-8",
        )

        self._connection = None
        self._source = "cleared"

    def save_connection(self, connection: RedmineConfig) -> None:
        if not self.can_persist():
            raise RuntimeError("Environment-managed Redmine settings cannot be overwritten from the UI.")

        payload = {
            "redmine": {
                "base_url": connection.base_url,
                "auth_type": connection.auth_type,
            }
        }

        if connection.auth_type == "api_key":
            payload["redmine"]["api_key"] = connection.api_key or ""
        else:
            payload["redmine"]["username"] = connection.username or ""
            payload["redmine"]["password"] = connection.password or ""

        self._runtime_path.write_text(
            json.dumps(payload, ensure_ascii=True, indent=2),
            encoding="utf-8",
        )

        self._connection = self._merge_with_defaults(connection)
        self._source = "file"

    def _load_current(self) -> tuple[RedmineConfig | None, str]:
        env_connection = self._load_from_environment()
        if env_connection is not None:
            return env_connection, "environment"

        file_connection, disabled = self._load_from_runtime_file()
        if disabled:
            return None, "cleared"
        if file_connection is not None:
            return file_connection, "file"

        legacy_connection = self._load_from_legacy_config()
        if legacy_connection is not None:
            return legacy_connection, "legacy_config"

        return None, "none"

    def _load_from_environment(self) -> RedmineConfig | None:
        base_url = (os.getenv("REDMINE_BASE_URL") or "").strip().rstrip("/")
        auth_type = (os.getenv("REDMINE_AUTH_TYPE") or "api_key").strip() or "api_key"
        api_key = os.getenv("REDMINE_API_KEY")
        username = os.getenv("REDMINE_USERNAME")
        password = os.getenv("REDMINE_PASSWORD")

        if not base_url:
            return None

        if auth_type == "api_key" and not api_key:
            return None
        if auth_type == "basic" and (not username or not password):
            return None

        return self._merge_with_defaults(
            RedmineConfig(
                base_url=base_url,
                auth_type=auth_type,
                api_key=api_key,
                username=username,
                password=password,
            )
        )

    def _load_from_runtime_file(self) -> tuple[RedmineConfig | None, bool]:
        if not self._runtime_path.exists():
            return None, False

        raw = json.loads(self._runtime_path.read_text(encoding="utf-8"))
        redmine = raw.get("redmine") or {}
        if redmine.get("disabled") is True:
            return None, True

        base_url = (redmine.get("base_url") or "").strip().rstrip("/")
        auth_type = redmine.get("auth_type", "api_key")

        if not base_url:
            return None, False

        connection = RedmineConfig(
            base_url=base_url,
            auth_type=auth_type,
            api_key=redmine.get("api_key"),
            username=redmine.get("username"),
            password=redmine.get("password"),
        )

        if connection.auth_type == "api_key" and not connection.api_key:
            return None, False
        if connection.auth_type == "basic" and (not connection.username or not connection.password):
            return None, False

        return self._merge_with_defaults(connection), False

    def _load_from_legacy_config(self) -> RedmineConfig | None:
        redmine = self._settings.redmine
        if redmine is None or not redmine.base_url:
            return None

        if redmine.auth_type == "api_key" and not redmine.api_key:
            return None
        if redmine.auth_type == "basic" and (not redmine.username or not redmine.password):
            return None

        return self._merge_with_defaults(redmine)

    def _build_runtime_defaults(self, redmine: RedmineConfig | None) -> RedmineConfig:
        if redmine is not None:
            return RedmineConfig(
                base_url="",
                auth_type=redmine.auth_type,
                timeout=redmine.timeout,
                retry_attempts=redmine.retry_attempts,
                page_size=redmine.page_size,
            )

        return RedmineConfig(base_url="")

    def _merge_with_defaults(self, connection: RedmineConfig) -> RedmineConfig:
        defaults = self._runtime_defaults
        return RedmineConfig(
            base_url=connection.base_url.rstrip("/"),
            auth_type=connection.auth_type,
            api_key=connection.api_key,
            username=connection.username,
            password=connection.password,
            timeout=connection.timeout or defaults.timeout,
            retry_attempts=connection.retry_attempts or defaults.retry_attempts,
            page_size=connection.page_size or defaults.page_size,
        )