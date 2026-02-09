from typing import Literal

from pydantic import BaseModel, Field


class AiSettingsResponse(BaseModel):
    llm_base_url: str | None = None
    llm_model: str | None = None
    embedding_base_url: str | None = None
    embedding_model: str | None = None
    embedding_dimensions: int | None = None
    has_llm_api_key: bool = False
    has_embedding_api_key: bool = False


class AiSettingsUpdate(BaseModel):
    llm_api_key: str | None = Field(default=None)
    llm_base_url: str | None = None
    llm_model: str | None = None
    embedding_api_key: str | None = Field(default=None)
    embedding_base_url: str | None = None
    embedding_model: str | None = None
    embedding_dimensions: int | None = Field(default=None, ge=1, le=4096)


class AiSettingsTestRequest(BaseModel):
    target: Literal["all", "llm", "embedding"] = "all"


class AiSettingsTestResponse(BaseModel):
    llm_ok: bool | None = None
    llm_error: str | None = None
    llm_latency_ms: int | None = None
    embedding_ok: bool | None = None
    embedding_error: str | None = None
    embedding_latency_ms: int | None = None
