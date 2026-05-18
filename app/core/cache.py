"""
core/cache.py — TTL 기반 인메모리 캐시 (LRU 정책 포함)
dict 구조: {key: (data, expire_at, last_access_time)}
asyncio.Lock으로 동시 요청 시 캐시 충돌 방지
"""
import asyncio
from collections import OrderedDict
from time import monotonic
from typing import Any, Callable, Awaitable


class TTLCache:
    """TTL(Time-To-Live) 기반 인메모리 캐시 (LRU 정책 포함)"""

    def __init__(self, default_ttl: int = 300, max_size: int = 1000):
        # 기본 TTL (초 단위)
        self._default_ttl = default_ttl
        # 최대 캐시 크기 (항목 수)
        self._max_size = max_size
        # 캐시 저장소: {key: (data, expire_at, last_access_time)}
        # OrderedDict로 LRU 순서 추적
        self._store: OrderedDict[str, tuple[Any, float, float]] = OrderedDict()
        # 동시 접근 제어용 락
        self._lock = asyncio.Lock()

    async def get_or_set(
        self,
        key: str,
        factory: Callable[[], Awaitable[Any]],
        ttl: int | None = None,
    ) -> Any:
        """
        캐시 조회 후 히트하면 즉시 반환.
        미스 시 factory 호출 → 결과를 캐시에 저장 후 반환.
        """
        effective_ttl = ttl if ttl is not None else self._default_ttl
        now = monotonic()

        # 캐시 히트 확인 (락 범위 최소화)
        async with self._lock:
            if key in self._store:
                data, expire_at, _ = self._store[key]
                if now < expire_at:
                    # LRU: 접근 시간 업데이트 및 순서 갱신
                    self._store.move_to_end(key)
                    self._store[key] = (data, expire_at, now)
                    return data
                # 만료된 항목 삭제
                del self._store[key]

        # 캐시 미스: factory 호출 (락 밖에서 실행하여 블로킹 최소화)
        result = await factory()

        # 결과 캐시 저장
        async with self._lock:
            # 최대 크기 초과 시 가장 오래된 항목 제거 (LRU)
            if len(self._store) >= self._max_size:
                oldest_key = next(iter(self._store))
                del self._store[oldest_key]
            
            self._store[key] = (result, now + effective_ttl, now)
            # 새 항목을 끝에 추가 (most recently used)
            self._store.move_to_end(key)

        return result

    async def invalidate(self, key: str) -> bool:
        """특정 캐시 키 무효화. 삭제 성공 시 True 반환"""
        async with self._lock:
            if key in self._store:
                del self._store[key]
                return True
            return False

    async def invalidate_prefix(self, prefix: str) -> int:
        """특정 접두사로 시작하는 모든 캐시 키 무효화. 삭제 건수 반환"""
        async with self._lock:
            keys_to_delete = [k for k in self._store if k.startswith(prefix)]
            for k in keys_to_delete:
                del self._store[k]
            return len(keys_to_delete)

    async def clear(self) -> int:
        """전체 캐시 초기화. 삭제 건수 반환"""
        async with self._lock:
            count = len(self._store)
            self._store.clear()
            return count

    async def evict_expired(self) -> int:
        """만료된 항목만 정리. 정리 건수 반환"""
        now = monotonic()
        async with self._lock:
            expired = [k for k, (_, exp, _) in self._store.items() if now >= exp]
            for k in expired:
                del self._store[k]
            return len(expired)

    def stats(self) -> dict[str, int]:
        """현재 캐시 상태 통계 (디버깅용)"""
        now = monotonic()
        total = len(self._store)
        active = sum(1 for _, exp, _ in self._store.values() if now < exp)
        return {
            "total_keys": total,
            "active_keys": active,
            "expired_keys": total - active,
            "max_size": self._max_size,
            "usage_percent": int((total / self._max_size * 100)) if self._max_size > 0 else 0,
        }
