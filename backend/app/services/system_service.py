import os
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import func, select

from app.core.redis import get_redis
from app.models.task_log import TaskLog
from app.repositories.user_repo import UserRepository


class SystemService:
    def __init__(self, session) -> None:
        self._session = session
        self._users = UserRepository(session)

    async def get_init_status(self) -> dict[str, bool]:
        count = await self._users.count_users()
        return {"initialized": count > 0}

    async def get_status(self) -> dict[str, Any]:
        init_status = await self.get_init_status()
        memory_total, memory_available = _read_memory_bytes()
        cpu_load = _read_cpu_load_1m()
        queue_depth = await _read_celery_queue_depth()
        success_1h, failed_1h = await self._read_task_outcomes_1h()
        total_1h = success_1h + failed_1h
        success_rate = (success_1h / total_1h) if total_1h > 0 else None
        return {
            **init_status,
            "cpu_load_1m": cpu_load,
            "memory_total_bytes": memory_total,
            "memory_available_bytes": memory_available,
            "celery_queue_depth": queue_depth,
            "task_success_1h": success_1h,
            "task_failed_1h": failed_1h,
            "task_success_rate_1h": success_rate,
        }

    async def _read_task_outcomes_1h(self) -> tuple[int, int]:
        since = datetime.now(timezone.utc) - timedelta(hours=1)
        stmt = (
            select(
                func.count().filter(TaskLog.status == "success").label("success_count"),
                func.count().filter(TaskLog.status == "failed").label("failed_count"),
            )
            .where(TaskLog.created_at >= since)
        )
        row = (await self._session.execute(stmt)).one()
        return int(row.success_count or 0), int(row.failed_count or 0)


def _read_cpu_load_1m() -> float | None:
    try:
        return os.getloadavg()[0]
    except OSError:
        return None


def _read_memory_bytes() -> tuple[int | None, int | None]:
    meminfo_path = "/proc/meminfo"
    if not os.path.exists(meminfo_path):
        return None, None

    total_kb = None
    available_kb = None

    with open(meminfo_path, "r", encoding="utf-8") as meminfo:
        for line in meminfo:
            if line.startswith("MemTotal:"):
                total_kb = _parse_meminfo_kb(line)
            elif line.startswith("MemAvailable:"):
                available_kb = _parse_meminfo_kb(line)

    total_bytes = total_kb * 1024 if total_kb is not None else None
    available_bytes = available_kb * 1024 if available_kb is not None else None
    return total_bytes, available_bytes


def _parse_meminfo_kb(line: str) -> int | None:
    parts = line.split()
    if len(parts) < 2:
        return None
    try:
        return int(parts[1])
    except ValueError:
        return None


async def _read_celery_queue_depth() -> int | None:
    queue_name = os.getenv("CELERY_DEFAULT_QUEUE", "celery_default")
    redis = get_redis()
    try:
        depth = await redis.llen(queue_name)
        return int(depth)
    except Exception:
        return None
    finally:
        await redis.close()
