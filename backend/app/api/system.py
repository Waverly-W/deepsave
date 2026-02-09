import asyncio
import os
import time

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_session
from app.core.ai_settings import get_ai_settings as resolve_ai_settings
from app.exceptions import NotFoundError
from app.schemas.access_token import AccessTokenCreate, AccessTokenResponse
from app.schemas.ai_settings import (
    AiSettingsResponse,
    AiSettingsTestRequest,
    AiSettingsTestResponse,
    AiSettingsUpdate,
)
from app.schemas.system import SystemInitStatus, SystemStatus
from app.services.access_token_service import AccessTokenService
from app.services.ai_settings_service import AiSettingsService
from app.services.system_service import SystemService

router = APIRouter(prefix="/system", tags=["System"])


@router.get("/status", response_model=SystemStatus)
async def system_status(
    session: AsyncSession = Depends(get_async_session),
) -> SystemStatus:
    service = SystemService(session)
    return SystemStatus(**(await service.get_status()))


@router.get("/init-status", response_model=SystemInitStatus)
async def init_status(
    session: AsyncSession = Depends(get_async_session),
) -> SystemInitStatus:
    service = SystemService(session)
    return SystemInitStatus(**(await service.get_init_status()))


@router.post(
    "/keys",
    response_model=AccessTokenResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_access_token(
    payload: AccessTokenCreate,
    session: AsyncSession = Depends(get_async_session),
) -> AccessTokenResponse:
    service = AccessTokenService(session)
    try:
        token = await service.create_access_token(payload.label)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return AccessTokenResponse(access_token=token)


@router.get("/ai-settings", response_model=AiSettingsResponse)
async def get_ai_settings(
    session: AsyncSession = Depends(get_async_session),
) -> AiSettingsResponse:
    settings = await resolve_ai_settings(session)
    return AiSettingsResponse(
        llm_base_url=settings.llm_base_url,
        llm_model=settings.llm_model,
        embedding_base_url=settings.embedding_base_url,
        embedding_model=settings.embedding_model,
        embedding_dimensions=settings.embedding_dimensions,
        has_llm_api_key=bool(settings.llm_api_key),
        has_embedding_api_key=bool(settings.embedding_api_key),
    )


@router.put("/ai-settings", response_model=AiSettingsResponse)
async def update_ai_settings(
    payload: AiSettingsUpdate,
    session: AsyncSession = Depends(get_async_session),
) -> AiSettingsResponse:
    service = AiSettingsService(session)
    await service.upsert_settings(payload)
    settings = await resolve_ai_settings(session)
    return AiSettingsResponse(
        llm_base_url=settings.llm_base_url,
        llm_model=settings.llm_model,
        embedding_base_url=settings.embedding_base_url,
        embedding_model=settings.embedding_model,
        embedding_dimensions=settings.embedding_dimensions,
        has_llm_api_key=bool(settings.llm_api_key),
        has_embedding_api_key=bool(settings.embedding_api_key),
    )


@router.post("/ai-settings/test", response_model=AiSettingsTestResponse)
async def test_ai_settings(
    payload: AiSettingsTestRequest,
    session: AsyncSession = Depends(get_async_session),
) -> AiSettingsTestResponse:
    settings = await resolve_ai_settings(session)
    response = AiSettingsTestResponse()

    if payload.target in {"all", "llm"}:
        ok, error, latency = await _test_llm(settings)
        response.llm_ok = ok
        response.llm_error = error
        response.llm_latency_ms = latency

    if payload.target in {"all", "embedding"}:
        ok, error, latency = await _test_embedding(settings)
        response.embedding_ok = ok
        response.embedding_error = error
        response.embedding_latency_ms = latency

    return response


async def _test_llm(settings) -> tuple[bool, str | None, int | None]:
    if not settings.llm_api_key:
        return False, "missing_api_key", None

    base = (settings.llm_base_url or "https://api.openai.com/v1").rstrip("/")
    if not base.endswith("/v1"):
        base = f"{base}/v1"
    endpoint = f"{base}/chat/completions"
    payload = {
        "model": settings.llm_model or "gpt-4o-mini",
        "messages": [{"role": "user", "content": "Reply with OK."}],
        "temperature": 0.0,
    }
    headers = {"Authorization": f"Bearer {settings.llm_api_key}"}

    soft_timeout = float(
        os.getenv("LLM_TIMEOUT_SOFT_S", os.getenv("LLM_TIMEOUT_S", "10"))
    )
    hard_timeout = float(
        os.getenv("LLM_TIMEOUT_HARD_S", os.getenv("LLM_TIMEOUT_S", "20"))
    )
    if hard_timeout < soft_timeout:
        hard_timeout = soft_timeout

    start = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=hard_timeout) as client:
            await asyncio.wait_for(
                client.post(endpoint, json=payload, headers=headers),
                timeout=soft_timeout,
            )
    except Exception as exc:  # noqa: BLE001
        return False, str(exc), None
    latency_ms = int((time.perf_counter() - start) * 1000)
    return True, None, latency_ms


async def _test_embedding(settings) -> tuple[bool, str | None, int | None]:
    if not settings.embedding_api_key:
        return False, "missing_api_key", None

    base = (settings.embedding_base_url or "https://dashscope.aliyuncs.com/compatible-mode/v1").rstrip("/")
    endpoint = f"{base}/embeddings"
    dimensions = settings.embedding_dimensions or 1024
    payload = {
        "model": settings.embedding_model or "text-embedding-v4",
        "input": ["ping"],
        "dimensions": dimensions,
        "encoding_format": "float",
    }
    headers = {"Authorization": f"Bearer {settings.embedding_api_key}"}

    soft_timeout = float(
        os.getenv("EMBEDDING_TIMEOUT_SOFT_S", os.getenv("EMBEDDING_TIMEOUT_S", "10"))
    )
    hard_timeout = float(
        os.getenv("EMBEDDING_TIMEOUT_HARD_S", os.getenv("EMBEDDING_TIMEOUT_S", "20"))
    )
    if hard_timeout < soft_timeout:
        hard_timeout = soft_timeout

    start = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=hard_timeout) as client:
            response = await asyncio.wait_for(
                client.post(endpoint, json=payload, headers=headers),
                timeout=soft_timeout,
            )
            response.raise_for_status()
            data = response.json()
    except Exception as exc:  # noqa: BLE001
        return False, str(exc), None

    items = data.get("data", [])
    if not items:
        return False, "no_embedding_data", None
    vector = items[0].get("embedding")
    if not isinstance(vector, list) or len(vector) != dimensions:
        return False, "embedding_dimension_mismatch", None

    latency_ms = int((time.perf_counter() - start) * 1000)
    return True, None, latency_ms
