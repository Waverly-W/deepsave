from pydantic import BaseModel


class SystemInitStatus(BaseModel):
    initialized: bool


class SystemStatus(BaseModel):
    initialized: bool
    cpu_load_1m: float | None = None
    memory_total_bytes: int | None = None
    memory_available_bytes: int | None = None
    celery_queue_depth: int | None = None
    task_success_1h: int = 0
    task_failed_1h: int = 0
    task_success_rate_1h: float | None = None
