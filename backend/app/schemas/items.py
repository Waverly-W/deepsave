from datetime import datetime
import uuid

from pydantic import BaseModel, Field


class IngestRequest(BaseModel):
    url: str = Field(min_length=1)
    source_type: str | None = None
    content_text: str | None = None
    title: str | None = None


class IngestResponse(BaseModel):
    task_id: str
    item_id: str
    reused: bool = False


class TaskStatusResponse(BaseModel):
    task_id: str
    status: str
    item_id: str | None = None


class RequeueResponse(BaseModel):
    task_id: str
    item_id: str


class ItemListItem(BaseModel):
    model_config = {"from_attributes": True}

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


class ItemDetailResponse(ItemListItem):
    content_text: str | None


class ItemUpdateRequest(BaseModel):
    is_archived: bool | None = None
    is_deleted: bool | None = None
    is_read: bool | None = None
    content_text: str | None = None
    title: str | None = None


class ItemsListResponse(BaseModel):
    items: list[ItemListItem]
    next_cursor: str | None = None


class TagCount(BaseModel):
    tag: str
    count: int


class ItemsOverviewResponse(BaseModel):
    total_count: int
    unread_count: int
    processing_count: int
    stale_count: int
    today_count: int
    latest_created_at: datetime | None = None
    top_tags: list[TagCount] = []
