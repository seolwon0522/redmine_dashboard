"""
client/redmine_client.py — Redmine REST API 비동기 클라이언트
페이지네이션 자동 처리, 인증 방식은 연결 설정에 따라 동적으로 처리한다.
"""
import asyncio
import base64
import logging
from collections.abc import Callable
from typing import Any
from urllib.parse import urlparse

import httpx

from app.core.config import RedmineConfig

logger = logging.getLogger(__name__)

_TRANSIENT_STATUS_CODES = {429, 502, 503, 504}


class RedmineClientError(Exception):
    """Redmine 클라이언트 기본 예외."""


class RedmineNotConfiguredError(RedmineClientError):
    """Redmine 연결 설정이 없는 경우."""


class RedmineAuthenticationError(RedmineClientError):
    """Redmine 인증 실패."""


class RedmineConnectionError(RedmineClientError):
    """Redmine 네트워크 연결 실패."""


class RedmineTimeoutError(RedmineClientError):
    """Redmine 응답 지연."""


class RedmineResponseError(RedmineClientError):
    """Redmine 비정상 응답."""

    def __init__(self, status_code: int, message: str = "Redmine returned an unexpected response."):
        super().__init__(message)
        self.status_code = status_code


class RedmineClient:
    """Redmine REST API 비동기 클라이언트"""

    def __init__(self, connection_provider: Callable[[], RedmineConfig | None], http_client: httpx.AsyncClient):
        self._connection_provider = connection_provider
        self._http = http_client

    @property
    def base_url(self) -> str:
        connection = self._connection_provider()
        return connection.base_url if connection is not None else ""

    async def _get(
        self,
        path: str,
        params: dict[str, Any] | None = None,
        connection: RedmineConfig | None = None,
    ) -> dict[str, Any]:
        """단일 GET 요청. 응답 JSON 반환"""
        response = await self._request(
            "GET",
            path,
            params=params or {},
            connection=connection,
        )

        try:
            return response.json()
        except ValueError as exc:
            raise RedmineResponseError(502, "Redmine returned invalid JSON.") from exc

    async def _request(
        self,
        method: str,
        path: str,
        params: dict[str, Any] | None = None,
        json_data: dict[str, Any] | None = None,
        connection: RedmineConfig | None = None,
        follow_redirects: bool = False,
        absolute_url: bool = False,
    ) -> httpx.Response:
        config = self._resolve_connection(connection)
        url = path if absolute_url else f"{config.base_url}{path}"
        headers = self._build_auth_headers(config)
        attempts = max(config.retry_attempts, 1)

        for attempt in range(1, attempts + 1):
            try:
                response = await self._http.request(
                    method,
                    url,
                    params=params or {},
                    json=json_data,
                    headers=headers,
                    timeout=config.timeout,
                    follow_redirects=follow_redirects,
                )
            except httpx.TimeoutException as exc:
                if attempt < attempts:
                    await asyncio.sleep(0.2 * attempt)
                    continue
                raise RedmineTimeoutError("Redmine request timed out.") from exc
            except httpx.ConnectError as exc:
                if attempt < attempts:
                    await asyncio.sleep(0.2 * attempt)
                    continue
                raise RedmineConnectionError("Could not connect to the Redmine server.") from exc
            except httpx.RequestError as exc:
                if attempt < attempts:
                    await asyncio.sleep(0.2 * attempt)
                    continue
                raise RedmineConnectionError("Redmine request failed.") from exc

            if response.status_code in {401, 403}:
                raise RedmineAuthenticationError("Redmine rejected the provided credentials.")

            if response.status_code in _TRANSIENT_STATUS_CODES and attempt < attempts:
                await asyncio.sleep(0.2 * attempt)
                continue

            if response.status_code >= 400:
                raise RedmineResponseError(response.status_code)

            return response

        raise RedmineResponseError(502)

    def _resolve_connection(self, connection: RedmineConfig | None = None) -> RedmineConfig:
        config = connection or self._connection_provider()
        if config is None or not config.base_url:
            raise RedmineNotConfiguredError("Redmine connection settings are missing.")

        if config.auth_type == "api_key" and not config.api_key:
            raise RedmineNotConfiguredError("An API key is required for API Key authentication.")

        if config.auth_type == "basic" and (not config.username or not config.password):
            raise RedmineNotConfiguredError("Username and password are required for ID / Password authentication.")

        return config

    def _build_auth_headers(self, config: RedmineConfig) -> dict[str, str]:
        if config.auth_type == "basic":
            credentials = f"{config.username}:{config.password}".encode("utf-8")
            encoded = base64.b64encode(credentials).decode("ascii")
            return {"Authorization": f"Basic {encoded}"}

        return {"X-Redmine-API-Key": config.api_key or ""}

    async def fetch_all_issues(self, params: dict[str, Any] | None = None) -> list[dict[str, Any]]:
        """
        이슈 전체 목록 조회 (페이지네이션 자동 처리)
        Redmine의 total_count를 기반으로 모든 페이지를 순회
        """
        params = dict(params or {})
        page_size = self._resolve_connection().page_size
        params.setdefault("limit", page_size)
        params["offset"] = 0

        all_issues: list[dict] = []

        while True:
            data = await self._get("/issues.json", params)
            issues = data.get("issues", [])
            total_count = data.get("total_count", 0)

            all_issues.extend(issues)
            logger.debug("이슈 페이지 조회: offset=%d, 수신=%d, 전체=%d", params["offset"], len(issues), total_count)

            # 다음 페이지가 없으면 종료
            params["offset"] += page_size
            if params["offset"] >= total_count:
                break

        return all_issues

    async def fetch_projects(self) -> list[dict[str, Any]]:
        """접근 가능한 전체 프로젝트 목록 조회 (페이지네이션 자동 처리)"""
        page_size = self._resolve_connection().page_size
        params: dict[str, Any] = {"limit": page_size, "offset": 0}
        all_projects: list[dict] = []

        while True:
            data = await self._get("/projects.json", params)
            projects = data.get("projects", [])
            total_count = data.get("total_count", 0)

            all_projects.extend(projects)

            params["offset"] += page_size
            if params["offset"] >= total_count:
                break

        return all_projects

    async def fetch_issue_detail(self, issue_id: int, include: str = "journals") -> dict[str, Any]:
        """단일 이슈 상세 조회 (journals 포함)"""
        data = await self._get(f"/issues/{issue_id}.json", {"include": include})
        return data.get("issue", {})

    async def _put(
        self,
        path: str,
        json_data: dict[str, Any],
        connection: RedmineConfig | None = None,
    ) -> httpx.Response:
        """단일 PUT 요청."""
        response = await self._request("PUT", path, json_data=json_data, connection=connection)
        try:
            return response
        except ValueError as exc:
            raise RedmineResponseError(502, "Redmine returned invalid JSON.") from exc

    async def update_issue(self, issue_id: int, payload: dict[str, Any]) -> None:
        """이슈 업데이트 (상태 변경 등)"""
        await self._put(f"/issues/{issue_id}.json", json_data={"issue": payload})

    async def fetch_asset(self, asset_url: str) -> httpx.Response:
        """Redmine 보호 리소스를 현재 인증 방식으로 프록시 조회"""
        connection = self._resolve_connection()
        parsed = urlparse(asset_url)
        allowed_base = urlparse(connection.base_url)

        if parsed.scheme not in {"http", "https"}:
            raise ValueError("지원하지 않는 리소스 URL입니다")
        if parsed.netloc != allowed_base.netloc:
            raise ValueError("Redmine 외부 리소스는 프록시할 수 없습니다")

        return await self._request(
            "GET",
            asset_url,
            connection=connection,
            follow_redirects=True,
            absolute_url=True,
        )

    async def fetch_html_page(self, path_or_url: str, absolute_url: bool = False) -> str:
        response = await self._request(
            "GET",
            path_or_url,
            connection=self._resolve_connection(),
            follow_redirects=True,
            absolute_url=absolute_url,
        )
        return response.text

    async def test_connection(self, connection: RedmineConfig | None = None) -> str | None:
        """연결 정보를 검증하고 현재 사용자 이름을 반환한다."""
        data = await self._get("/users/current.json", connection=connection)
        user = data.get("user") or {}
        return user.get("firstname") or user.get("login") or user.get("lastname")
