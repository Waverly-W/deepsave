from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.encryption import encrypt_secret
from app.models.ai_settings import AiSettings
from app.schemas.ai_settings import AiSettingsUpdate


class AiSettingsService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_settings(self) -> AiSettings | None:
        result = await self._session.execute(select(AiSettings).limit(1))
        return result.scalar_one_or_none()

    async def upsert_settings(self, payload: AiSettingsUpdate) -> AiSettings:
        settings = await self.get_settings()
        if settings is None:
            settings = AiSettings()
            self._session.add(settings)
            await self._session.flush()

        fields = payload.model_fields_set

        if "llm_base_url" in fields:
            settings.llm_base_url = _normalize_text(payload.llm_base_url)
        if "llm_model" in fields:
            settings.llm_model = _normalize_text(payload.llm_model)
        if "summary_system_prompt" in fields:
            settings.summary_system_prompt = _normalize_text(payload.summary_system_prompt)
        if "summary_user_prompt_template" in fields:
            settings.summary_user_prompt_template = _normalize_text(
                payload.summary_user_prompt_template
            )
        if "polish_system_prompt" in fields:
            settings.polish_system_prompt = _normalize_text(payload.polish_system_prompt)
        if "polish_user_prompt_template" in fields:
            settings.polish_user_prompt_template = _normalize_text(
                payload.polish_user_prompt_template
            )
        if "vision_user_prompt" in fields:
            settings.vision_user_prompt = _normalize_text(payload.vision_user_prompt)
        if "embedding_base_url" in fields:
            settings.embedding_base_url = _normalize_text(payload.embedding_base_url)
        if "embedding_model" in fields:
            settings.embedding_model = _normalize_text(payload.embedding_model)
        if "embedding_dimensions" in fields:
            settings.embedding_dimensions = payload.embedding_dimensions

        if "llm_api_key" in fields:
            normalized = _normalize_text(payload.llm_api_key)
            settings.llm_api_key_encrypted = (
                encrypt_secret(normalized) if normalized else None
            )
        if "embedding_api_key" in fields:
            normalized = _normalize_text(payload.embedding_api_key)
            settings.embedding_api_key_encrypted = (
                encrypt_secret(normalized) if normalized else None
            )

        return settings


def _normalize_text(value: str | None) -> str | None:
    if value is None:
        return None
    trimmed = value.strip()
    return trimmed if trimmed else None
