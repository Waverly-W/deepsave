from pydantic import BaseModel


class SystemInitStatus(BaseModel):
    initialized: bool


class SystemStatus(BaseModel):
    initialized: bool
    cpu_load_1m: float | None = None
    memory_total_bytes: int | None = None
    memory_available_bytes: int | None = None
