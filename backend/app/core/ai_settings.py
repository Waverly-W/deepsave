from __future__ import annotations

import os
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.prompt_templates import (
    DEFAULT_POLISH_SYSTEM_PROMPT,
    DEFAULT_POLISH_USER_PROMPT_TEMPLATE,
    DEFAULT_SUMMARY_SYSTEM_PROMPT,
    DEFAULT_SUMMARY_USER_PROMPT_TEMPLATE,
    DEFAULT_VISION_USER_PROMPT,
)
from app.core.database import async_session_factory
from app.core.encryption import decrypt_secret
from app.models.ai_settings import AiSettings

DEFAULT_LLM_MODEL = "gpt-4o-mini"
DEFAULT_EMBEDDING_MODEL = "text-embedding-v4"
DEFAULT_EMBEDDING_DIMENSIONS = 1024
DEFAULT_EMBEDDING_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"


@dataclass
class AiRuntimeSettings:
    llm_api_key: str | None
    llm_base_url: str | None
    llm_model: str | None
    summary_system_prompt: str
    summary_user_prompt_template: str
    polish_system_prompt: str
    polish_user_prompt_template: str
    vision_user_prompt: str
    embedding_api_key: str | None
    embedding_base_url: str | None
    embedding_model: str | None
    embedding_dimensions: int | None
    vision_api_key: str | None
    vision_base_url: str | None
    vision_model: str | None


async def get_ai_settings(session: AsyncSession | None = None) -> AiRuntimeSettings:
    settings = await _load_settings(session)

    llm_api_key = decrypt_secret(settings.llm_api_key_encrypted) if settings else None
    llm_api_key = llm_api_key or _env_value("LLM_API_KEY", "OPENAI_API_KEY")

    llm_base_url = (settings.llm_base_url if settings else None) or _env_value(
        "LLM_BASE_URL",
        "OPENAI_BASE_URL",
        "OPENAI_API_BASE",
    )

    llm_model = (settings.llm_model if settings else None) or _env_value(
        "LLM_MODEL", "OPENAI_MODEL"
    )
    llm_model = llm_model or DEFAULT_LLM_MODEL
    summary_system_prompt = (
        (settings.summary_system_prompt if settings else None)
        or DEFAULT_SUMMARY_SYSTEM_PROMPT
    )
    summary_user_prompt_template = (
        (settings.summary_user_prompt_template if settings else None)
        or DEFAULT_SUMMARY_USER_PROMPT_TEMPLATE
    )
    polish_system_prompt = (
        (settings.polish_system_prompt if settings else None)
        or DEFAULT_POLISH_SYSTEM_PROMPT
    )
    polish_user_prompt_template = (
        (settings.polish_user_prompt_template if settings else None)
        or DEFAULT_POLISH_USER_PROMPT_TEMPLATE
    )
    vision_user_prompt = (
        (settings.vision_user_prompt if settings else None)
        or DEFAULT_VISION_USER_PROMPT
    )

    embedding_api_key = (
        decrypt_secret(settings.embedding_api_key_encrypted) if settings else None
    )
    embedding_api_key = embedding_api_key or _env_value("ALIYUN_API_KEY")

    embedding_base_url = (settings.embedding_base_url if settings else None) or _env_value(
        "ALIYUN_EMBEDDING_BASE_URL"
    )
    embedding_base_url = embedding_base_url or DEFAULT_EMBEDDING_BASE_URL

    embedding_model = (settings.embedding_model if settings else None) or _env_value(
        "ALIYUN_EMBEDDING_MODEL"
    )
    embedding_model = embedding_model or DEFAULT_EMBEDDING_MODEL

    embedding_dimensions = settings.embedding_dimensions if settings else None
    if embedding_dimensions is None:
        env_dimensions = _env_value("ALIYUN_EMBEDDING_DIMENSIONS")
        if env_dimensions:
            try:
                embedding_dimensions = int(env_dimensions)
            except ValueError:
                embedding_dimensions = None
    embedding_dimensions = embedding_dimensions or DEFAULT_EMBEDDING_DIMENSIONS

    vision_api_key = _env_value("VISION_API_KEY") or llm_api_key
    vision_base_url = _env_value("VISION_BASE_URL") or llm_base_url
    vision_model = _env_value("VISION_MODEL") or llm_model

    return AiRuntimeSettings(
        llm_api_key=llm_api_key,
        llm_base_url=llm_base_url,
        llm_model=llm_model,
        summary_system_prompt=summary_system_prompt,
        summary_user_prompt_template=summary_user_prompt_template,
        polish_system_prompt=polish_system_prompt,
        polish_user_prompt_template=polish_user_prompt_template,
        vision_user_prompt=vision_user_prompt,
        embedding_api_key=embedding_api_key,
        embedding_base_url=embedding_base_url,
        embedding_model=embedding_model,
        embedding_dimensions=embedding_dimensions,
        vision_api_key=vision_api_key,
        vision_base_url=vision_base_url,
        vision_model=vision_model,
    )


async def _load_settings(session: AsyncSession | None) -> AiSettings | None:
    if session is None:
        async with async_session_factory() as db:
            result = await db.execute(select(AiSettings).limit(1))
            return result.scalar_one_or_none()

    result = await session.execute(select(AiSettings).limit(1))
    return result.scalar_one_or_none()


def _env_value(*keys: str) -> str | None:
    for key in keys:
        value = os.getenv(key)
        if value:
            return value
    return None
