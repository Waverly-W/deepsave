import uuid
from datetime import datetime

from sqlalchemy import DateTime, Integer, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class AiSettings(Base):
    __tablename__ = "ai_settings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    llm_api_key_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    llm_base_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    llm_model: Mapped[str | None] = mapped_column(Text, nullable=True)
    summary_system_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    summary_user_prompt_template: Mapped[str | None] = mapped_column(Text, nullable=True)
    polish_system_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    polish_user_prompt_template: Mapped[str | None] = mapped_column(Text, nullable=True)
    vision_user_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    embedding_api_key_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    embedding_base_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    embedding_model: Mapped[str | None] = mapped_column(Text, nullable=True)
    embedding_dimensions: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
