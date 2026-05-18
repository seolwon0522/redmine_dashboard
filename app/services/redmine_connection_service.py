"""Redmine 연결 관리 서비스."""

from fastapi import HTTPException, status

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
from app.core.config import RedmineConfig
from app.schemas.redmine_connection import RedmineConnectionRequest


class RedmineConnectionService:
    """Redmine 연결 테스트/저장/상태 조회를 담당한다."""

    def __init__(self, store: RedmineConnectionStore, client: RedmineClient, cache: TTLCache):
        self._store = store
        self._client = client
        self._cache = cache

    async def get_connection_status(self) -> dict:
        connection = self._store.get_connection()
        if connection is None:
            if self._store.get_source() == "cleared":
                return {
                    "configured": False,
                    "connected": False,
                    "can_save": self._store.can_persist(),
                    "message": "저장된 Redmine 연결 정보가 삭제되었습니다. 계속하려면 연결 정보를 다시 입력하세요.",
                    "warning": None,
                    "server_user": None,
                    "connection": None,
                }

            return {
                "configured": False,
                "connected": False,
                "can_save": self._store.can_persist(),
                "message": "대시보드 데이터를 불러오기 전에 Redmine 연결 정보를 먼저 설정하세요.",
                "warning": None,
                "server_user": None,
                "connection": None,
            }

        try:
            current_user = await self._client.test_connection(connection)
        except (RedmineAuthenticationError, RedmineConnectionError, RedmineTimeoutError, RedmineResponseError) as exc:
            return {
                "configured": True,
                "connected": False,
                "can_save": self._store.can_persist(),
                "message": self._message_for_exception(exc),
                "warning": self._https_warning(connection.base_url),
                "server_user": None,
                "connection": self._build_summary(connection, self._store.get_source()),
            }

        return {
            "configured": True,
            "connected": True,
            "can_save": self._store.can_persist(),
            "message": "Redmine 연결이 준비되었습니다.",
            "warning": self._https_warning(connection.base_url),
            "server_user": current_user,
            "connection": self._build_summary(connection, self._store.get_source()),
        }

    async def test_connection(self, payload: RedmineConnectionRequest) -> dict:
        connection = payload.to_config(self._store.get_runtime_defaults())

        try:
            current_user = await self._client.test_connection(connection)
        except RedmineNotConfiguredError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
        except RedmineAuthenticationError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=self._message_for_exception(exc),
            ) from exc
        except (RedmineConnectionError, RedmineTimeoutError, RedmineResponseError) as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=self._message_for_exception(exc),
            ) from exc

        return {
            "success": True,
            "message": "연결 테스트에 성공했습니다.",
            "warning": self._https_warning(connection.base_url),
            "server_user": current_user,
            "connection": self._build_summary(connection, self._store.get_source()),
        }

    async def save_connection(self, payload: RedmineConnectionRequest) -> dict:
        if not self._store.can_persist():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="이 환경은 Redmine 인증 정보를 환경 변수로 관리하고 있어 화면에서 덮어쓸 수 없습니다.",
            )

        connection = payload.to_config(self._store.get_runtime_defaults())
        test_result = await self.test_connection(payload)
        self._store.save_connection(connection)
        cleared_cache_keys = await self._cache.clear()

        return {
            "saved": True,
            "message": "Redmine 연결 정보를 저장했습니다.",
            "warning": self._https_warning(connection.base_url),
            "server_user": test_result["server_user"],
            "cleared_cache_keys": cleared_cache_keys,
            "connection": self._build_summary(connection, self._store.get_source()),
        }

    async def clear_connection(self) -> dict:
        if not self._store.can_persist():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="이 연결 정보는 환경 변수로 관리되고 있어 화면에서 삭제할 수 없습니다.",
            )

        self._store.clear_connection()
        cleared_cache_keys = await self._cache.clear()
        return {
            "deleted": True,
            "message": "저장된 Redmine 연결 정보를 삭제했습니다. 다시 연결하려면 정보를 새로 입력하세요.",
            "cleared_cache_keys": cleared_cache_keys,
        }

    def _build_summary(self, connection: RedmineConfig, source: str) -> dict:
        return {
            "base_url": connection.base_url,
            "auth_type": connection.auth_type,
            "auth_identity": self._mask_identity(connection),
            "source": source,
            "uses_https": connection.base_url.startswith("https://"),
        }

    def _mask_identity(self, connection: RedmineConfig) -> str:
        if connection.auth_type == "api_key":
            token = connection.api_key or ""
            if len(token) <= 4:
                return "API 키 설정됨"
            return f"API 키 ••••{token[-4:]}"

        username = connection.username or "Redmine 사용자"
        if len(username) <= 2:
            return f"사용자 {username[0]}*"
        return f"사용자 {username[:2]}***"

    def _https_warning(self, base_url: str) -> str | None:
        if base_url.startswith("https://"):
            return None
        return "로컬 개발 환경이 아니라면 Redmine 인증 정보를 저장하기 전에 HTTPS 사용을 권장합니다."

    def _message_for_exception(self, exc: Exception) -> str:
        if isinstance(exc, RedmineAuthenticationError):
            return "Redmine에서 인증을 거부했습니다. 인증 방식과 입력값을 다시 확인하세요."
        if isinstance(exc, RedmineTimeoutError):
            return "Redmine 서버 응답이 너무 늦습니다. URL과 네트워크 상태를 확인한 뒤 다시 시도하세요."
        if isinstance(exc, RedmineConnectionError):
            return "대시보드가 Redmine 서버에 연결하지 못했습니다. 기본 URL과 네트워크 접근 상태를 확인하세요."
        return "Redmine에서 예상하지 못한 응답이 왔습니다. 서버 주소와 인증 정보를 확인하세요."