import os
from typing import Any

from app.repositories.user_repo import UserRepository


class SystemService:
    def __init__(self, session) -> None:
        self._users = UserRepository(session)

    async def get_init_status(self) -> dict[str, bool]:
        count = await self._users.count_users()
        return {"initialized": count > 0}

    async def get_status(self) -> dict[str, Any]:
        init_status = await self.get_init_status()
        memory_total, memory_available = _read_memory_bytes()
        cpu_load = _read_cpu_load_1m()
        return {
            **init_status,
            "cpu_load_1m": cpu_load,
            "memory_total_bytes": memory_total,
            "memory_available_bytes": memory_available,
        }


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
