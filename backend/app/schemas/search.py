from datetime import datetime
import uuid

from pydantic import BaseModel, ConfigDict


class SearchResultItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    url: str
    normalized_url: str
    title: str | None
    summary: str | None
    cached_tags: str | None
    source_type: str
    meta_json: dict
    processing_status: str
    content_revision: int
    analysis_revision: int
    processing_target_revision: int | None = None
    is_archived: bool
    is_deleted: bool
    is_read: bool
    created_at: datetime
    updated_at: datetime
    word_count: int | None = None
    char_count: int | None = None
    rrf_score: float | None = None


class SearchResponse(BaseModel):
    query: str
    count: int
    items: list[SearchResultItem]
