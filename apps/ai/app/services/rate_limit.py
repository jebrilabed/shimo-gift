import asyncio
import time
from collections import defaultdict, deque

from fastapi import HTTPException


class SlidingWindowRateLimiter:
    """Best-effort per-process rate limit; each user key is bounded and never logged."""

    def __init__(self, limit: int = 12, window_seconds: int = 60, max_users: int = 10_000) -> None:
        self.limit = limit
        self.window_seconds = window_seconds
        self.max_users = max_users
        self._events: dict[str, deque[float]] = defaultdict(deque)
        self._lock = asyncio.Lock()

    async def check(self, user_id: str, now: float | None = None) -> None:
        instant = time.monotonic() if now is None else now
        async with self._lock:
            events = self._events[user_id]
            while events and events[0] <= instant - self.window_seconds:
                events.popleft()
            if len(events) >= self.limit:
                raise HTTPException(status_code=429, detail="Too many assistant requests. Please try again shortly.")
            events.append(instant)
            if len(self._events) > self.max_users:
                oldest_keys = sorted(self._events, key=lambda key: self._events[key][0] if self._events[key] else instant)
                for key in oldest_keys[: len(self._events) - self.max_users]:
                    self._events.pop(key, None)


chat_rate_limiter = SlidingWindowRateLimiter()
