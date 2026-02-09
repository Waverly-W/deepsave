import json
import uuid
from datetime import datetime

from celery.result import AsyncResult
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_session
from app.core.redis import get_redis
from app.schemas.items import (
    IngestRequest,
    IngestResponse,
    ItemDetailResponse,
    ItemsListResponse,
    ItemsOverviewResponse,
    ItemListItem,
    ItemUpdateRequest,
    RequeueResponse,
    TaskStatusResponse,
)
from app.services.ingest_service import IngestService
from app.services.items_service import ItemsService
from app.exceptions import NotFoundError
from app.utils.text_stats import count_text_stats
from app.worker.tasks import process_item, process_item_content
from app.services.ingest_service import LOCK_TTL_SECONDS, _lock_key

router = APIRouter(prefix="/items", tags=["Items"])


@router.post("/ingest", response_model=IngestResponse, status_code=status.HTTP_202_ACCEPTED)
async def ingest_item(
    payload: IngestRequest,
    session: AsyncSession = Depends(get_async_session),
) -> IngestResponse:
    service = IngestService(session)
    try:
        result = await service.ingest(
            payload.url,
            payload.source_type,
            content_text=payload.content_text,
            title=payload.title,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return IngestResponse(task_id=result.task_id, item_id=result.item_id, reused=result.reused)


@router.get("", response_model=ItemsListResponse)
async def list_items(
    cursor: datetime | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=50),
    source_type: str | None = Query(default=None, alias="type"),
    archived: bool = Query(default=False),
    session: AsyncSession = Depends(get_async_session),
) -> ItemsListResponse:
    service = ItemsService(session)
    items, next_cursor = await service.list_items(
        cursor=cursor,
        limit=limit,
        source_type=source_type,
        archived=archived,
    )
    payload = []
    for item in items:
        word_count, char_count = count_text_stats(item.content_text)
        payload.append(
            ItemListItem.model_validate(item, from_attributes=True).model_copy(
                update={"word_count": word_count, "char_count": char_count}
            )
        )
    return ItemsListResponse(
        items=payload,
        next_cursor=next_cursor.isoformat() if next_cursor else None,
    )


@router.get("/overview", response_model=ItemsOverviewResponse)
async def items_overview(
    session: AsyncSession = Depends(get_async_session),
) -> ItemsOverviewResponse:
    service = ItemsService(session)
    data = await service.get_overview()
    return ItemsOverviewResponse(**data)


@router.get("/tasks/{task_id}", response_model=TaskStatusResponse)
async def task_status(task_id: str) -> TaskStatusResponse:
    result = AsyncResult(task_id)
    state = result.state
    status_map = {
        "PENDING": "pending",
        "STARTED": "processing",
        "SUCCESS": "completed",
        "FAILURE": "failed",
    }
    return TaskStatusResponse(task_id=task_id, status=status_map.get(state, "processing"))


@router.post("/{item_id}/requeue", response_model=RequeueResponse, status_code=status.HTTP_202_ACCEPTED)
async def requeue_item(
    item_id: uuid.UUID,
    session: AsyncSession = Depends(get_async_session),
) -> RequeueResponse:
    service = ItemsService(session)
    try:
        item = await service.get_item(item_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    redis = get_redis()
    try:
        lock_key = _lock_key(item.normalized_url)
        existing = await redis.get(lock_key)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Item is already processing",
            )
        acquired = await redis.set(lock_key, "pending", nx=True, ex=LOCK_TTL_SECONDS)
        if not acquired:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Item is already processing",
            )

        item.processing_status = "pending"
        item.processing_target_revision = item.content_revision or 0
        task = process_item.delay(str(item.id), lock_key)
        payload = json.dumps({"task_id": task.id, "item_id": str(item.id)})
        await redis.set(lock_key, payload, ex=LOCK_TTL_SECONDS)
        return RequeueResponse(task_id=task.id, item_id=str(item.id))
    finally:
        await redis.close()


@router.post(
    "/{item_id}/reprocess-content",
    response_model=RequeueResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def reprocess_item_content(
    item_id: uuid.UUID,
    session: AsyncSession = Depends(get_async_session),
) -> RequeueResponse:
    service = ItemsService(session)
    try:
        item = await service.get_item(item_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    redis = get_redis()
    try:
        lock_key = _lock_key(item.normalized_url)
        existing = await redis.get(lock_key)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Item is already processing",
            )
        acquired = await redis.set(lock_key, "pending", nx=True, ex=LOCK_TTL_SECONDS)
        if not acquired:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Item is already processing",
            )

        item.processing_status = "pending"
        item.processing_target_revision = item.content_revision or 0
        task = process_item_content.delay(str(item.id), lock_key)
        payload = json.dumps({"task_id": task.id, "item_id": str(item.id)})
        await redis.set(lock_key, payload, ex=LOCK_TTL_SECONDS)
        return RequeueResponse(task_id=task.id, item_id=str(item.id))
    finally:
        await redis.close()


@router.get("/{item_id}", response_model=ItemDetailResponse)
async def get_item(
    item_id: uuid.UUID,
    session: AsyncSession = Depends(get_async_session),
) -> ItemDetailResponse:
    service = ItemsService(session)
    try:
        item = await service.get_item(item_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    word_count, char_count = count_text_stats(item.content_text)
    return ItemDetailResponse.model_validate(item, from_attributes=True).model_copy(
        update={"word_count": word_count, "char_count": char_count}
    )


@router.patch("/{item_id}", response_model=ItemDetailResponse)
async def update_item(
    item_id: uuid.UUID,
    payload: ItemUpdateRequest,
    session: AsyncSession = Depends(get_async_session),
) -> ItemDetailResponse:
    service = ItemsService(session)
    try:
        item = await service.update_item(
            item_id,
            is_archived=payload.is_archived,
            is_deleted=payload.is_deleted,
            is_read=payload.is_read,
            content_text=payload.content_text,
            title=payload.title,
        )
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    word_count, char_count = count_text_stats(item.content_text)
    return ItemDetailResponse.model_validate(item, from_attributes=True).model_copy(
        update={"word_count": word_count, "char_count": char_count}
    )
