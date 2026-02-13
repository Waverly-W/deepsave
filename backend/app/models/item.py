import uuid
from datetime import datetime

from sqlalchemy import Boolean, Computed, DateTime, Integer, String, Text, func, text
from sqlalchemy.dialects.postgresql import JSONB, TSVECTOR, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Item(Base):
    __tablename__ = "items"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    url: Mapped[str] = mapped_column(Text, nullable=False)
    normalized_url: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    title: Mapped[str | None] = mapped_column(Text, nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    content_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    content_tokens: Mapped[str | None] = mapped_column(Text, nullable=True)
    content_format: Mapped[str] = mapped_column(
        String(20), server_default=text("'html'"), nullable=False
    )
    content_search_vector: Mapped[str | None] = mapped_column(
        TSVECTOR,
        Computed("to_tsvector('simple', coalesce(content_tokens, ''))", persisted=True),
        nullable=True,
    )
    cached_tags: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_type: Mapped[str] = mapped_column(
        String(20), server_default=text("'article'"), nullable=False
    )
    meta_json: Mapped[dict] = mapped_column(
        JSONB, server_default=text("'{}'::jsonb"), nullable=False
    )
    processing_status: Mapped[str] = mapped_column(
        String(20), server_default=text("'pending'"), nullable=False
    )
    content_revision: Mapped[int] = mapped_column(
        Integer, server_default=text("0"), nullable=False
    )
    analysis_revision: Mapped[int] = mapped_column(
        Integer, server_default=text("0"), nullable=False
    )
    processing_target_revision: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )
    is_archived: Mapped[bool] = mapped_column(
        Boolean, server_default=text("false"), nullable=False
    )
    is_deleted: Mapped[bool] = mapped_column(
        Boolean, server_default=text("false"), nullable=False
    )
    is_read: Mapped[bool] = mapped_column(
        Boolean, server_default=text("false"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
