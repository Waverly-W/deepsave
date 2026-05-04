import json
import uuid
from datetime import datetime

from celery.result import AsyncResult
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.chunking import chunk_text
from app.ai.embedding import embed_texts
from app.ai.polisher import (
    JsonFieldStreamExtractor,
    build_polish_messages,
    parse_polish_output,
    stream_chat_completion,
)
from app.ai.summarizer import detect_language, summarize_text
from app.core.auth import require_auth
from app.core.ai_settings import get_ai_settings
from app.core.database import async_session_factory, get_async_session
from app.core.redis import get_redis
from app.exceptions import NotFoundError
from app.schemas.items import (
    CreateNoteRequest,
    CreateNoteResponse,
    IngestRequest,
    IngestResponse,
    ItemDetailResponse,
    ItemsListResponse,
    ItemsOverviewResponse,
    ItemListItem,
    ItemUpdateRequest,
    PolishDraftRequest,
    RequeueResponse,
    TaskStatusResponse,
)
from app.services.analysis_results import (
    TAG_CANDIDATE_LIMIT,
    TAG_MAX_DEPTH,
    load_tag_candidates,
    save_results,
    title_from_text,
)
from app.services.ingest_service import LOCK_TTL_SECONDS, _lock_key, normalize_url
from app.services.ingest_service import IngestConflictError, IngestService
from app.services.items_service import ItemsService
from app.utils.html import html_to_text
from app.utils.markdown import markdown_to_html
from app.utils.text_stats import count_text_stats
from app.utils.url_safety import UnsafeUrlError
from app.worker.client import (
    enqueue_polish_item_content,
    enqueue_process_item,
    enqueue_process_item_content,
)

router = APIRouter(
    prefix="/items",
    tags=["Items"],
    dependencies=[Depends(require_auth)],
)


def _sse_event(event: str, data: dict) -> str:
    payload = json.dumps(data, ensure_ascii=False)
    return f"event: {event}\ndata: {payload}\n\n"


@router.post("/ingest", response_model=IngestResponse, status_code=status.HTTP_202_ACCEPTED)
async def ingest_item(
    payload: IngestRequest,
    session: AsyncSession = Depends(get_async_session),
) -> IngestResponse:
    service = IngestService(session)
    try:
        result = await service.ingest(
            str(payload.url),
            payload.source_type,
            content_text=payload.content_text,
            title=payload.title,
        )
    except UnsafeUrlError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except IngestConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
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
        plain_text = html_to_text(item.content_text)
        word_count, char_count = count_text_stats(plain_text)
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
        task = enqueue_process_item(str(item.id), lock_key)
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
        task = enqueue_process_item_content(str(item.id), lock_key)
        payload = json.dumps({"task_id": task.id, "item_id": str(item.id)})
        await redis.set(lock_key, payload, ex=LOCK_TTL_SECONDS)
        return RequeueResponse(task_id=task.id, item_id=str(item.id))
    finally:
        await redis.close()


@router.post(
    "/{item_id}/polish-content",
    response_model=RequeueResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def polish_item_content_route(
    item_id: uuid.UUID,
    session: AsyncSession = Depends(get_async_session),
) -> RequeueResponse:
    service = ItemsService(session)
    try:
        item = await service.get_item(item_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    if item.source_type == "image":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Polish is not supported for image items",
        )

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
        task = enqueue_polish_item_content(str(item.id), lock_key)
        payload = json.dumps({"task_id": task.id, "item_id": str(item.id)})
        await redis.set(lock_key, payload, ex=LOCK_TTL_SECONDS)
        return RequeueResponse(task_id=task.id, item_id=str(item.id))
    finally:
        await redis.close()


@router.post(
    "/{item_id}/polish-now",
    status_code=status.HTTP_200_OK,
)
async def polish_item_now(
    item_id: uuid.UUID,
) -> StreamingResponse:
    async with async_session_factory() as session:
        service = ItemsService(session)
        try:
            item = await service.get_item(item_id)
        except NotFoundError as exc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(exc),
            ) from exc

        if item.source_type == "image":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Polish is not supported for image items",
            )

        if item.processing_status in {"pending", "processing"}:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Item is already processing",
            )

        content_text = item.content_text or ""
        plain_text = html_to_text(content_text) or ""
        base_title = item.title or title_from_text(plain_text) or item.url
        url = item.url

    if not plain_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Item has no content to polish",
        )

    async def event_stream():
        raw_output = ""
        extractor = JsonFieldStreamExtractor("content")
        try:
            async with async_session_factory() as session:
                settings = await get_ai_settings(session)

            if not settings.llm_api_key:
                yield _sse_event("error", {"message": "Missing LLM API key"})
                return

            language = detect_language(plain_text, base_title)
            messages = build_polish_messages(
                plain_text,
                title=base_title,
                url=url,
                settings=settings,
                language=language,
            )

            async for delta in stream_chat_completion(
                settings.llm_api_key,
                messages,
                base_url=settings.llm_base_url,
                model=settings.llm_model,
            ):
                raw_output += delta
                visible = extractor.feed(delta)
                if visible:
                    yield _sse_event("chunk", {"delta": visible})
        except Exception:
            yield _sse_event("error", {"message": "Polish failed"})
            return

        polish = parse_polish_output(
            raw_output,
            fallback_title=base_title,
            fallback_content=plain_text,
        )
        polished_html = markdown_to_html(polish.content_markdown) or content_text
        polished_plain_text = html_to_text(polished_html) or ""
        polished_title = polish.title or base_title

        try:
            tag_candidates = await load_tag_candidates(
                async_session_factory,
                limit=TAG_CANDIDATE_LIMIT,
                language=language,
            )
            analysis = await summarize_text(
                polished_plain_text,
                title=polished_title,
                url=url,
                settings=settings,
                existing_tags=tag_candidates,
                language=language,
                max_tag_depth=TAG_MAX_DEPTH,
            )
            chunk_texts = chunk_text(polished_plain_text) if polished_plain_text else []
            embeddings = (
                await embed_texts(chunk_texts, settings=settings)
                if chunk_texts
                else []
            )
            await save_results(
                async_session_factory,
                item_id,
                polished_title,
                polished_html,
                polished_plain_text,
                analysis.summary,
                analysis.tags,
                chunk_texts,
                embeddings,
            )
            async with async_session_factory() as session:
                updated_item = await ItemsService(session).get_item(item_id)

            yield _sse_event(
                "done",
                {
                    "title": updated_item.title,
                    "content_html": updated_item.content_text,
                    "content_revision": updated_item.content_revision,
                    "analysis_revision": updated_item.analysis_revision,
                },
            )
        except Exception:
            yield _sse_event("error", {"message": "Apply polish failed"})

    headers = {
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }
    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers=headers,
    )


@router.post(
    "/polish-draft",
    status_code=status.HTTP_200_OK,
)
async def polish_draft(
    payload: PolishDraftRequest,
) -> StreamingResponse:
    content_html = (payload.content_html or "").strip()
    plain_text = html_to_text(content_html) or ""
    if not plain_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Draft has no content to polish",
        )

    base_title = (payload.title or "").strip() or title_from_text(plain_text) or "Untitled"
    language = detect_language(plain_text, base_title)

    async def event_stream():
        raw_output = ""
        extractor = JsonFieldStreamExtractor("content")
        settings = None
        try:
            async with async_session_factory() as session:
                settings = await get_ai_settings(session)

            if not settings.llm_api_key:
                yield _sse_event("error", {"message": "Missing LLM API key"})
                return

            messages = build_polish_messages(
                plain_text,
                title=base_title,
                url=None,
                settings=settings,
                language=language,
            )

            async for delta in stream_chat_completion(
                settings.llm_api_key,
                messages,
                base_url=settings.llm_base_url,
                model=settings.llm_model,
            ):
                raw_output += delta
                visible = extractor.feed(delta)
                if visible:
                    yield _sse_event("chunk", {"delta": visible})
        except Exception:
            yield _sse_event("error", {"message": "Polish failed"})
            return

        polish = parse_polish_output(
            raw_output,
            fallback_title=base_title,
            fallback_content=plain_text,
        )
        polished_html = markdown_to_html(polish.content_markdown) or content_html
        polished_plain_text = html_to_text(polished_html) or ""
        polished_title = polish.title or base_title

        try:
            tag_candidates = await load_tag_candidates(
                async_session_factory,
                limit=TAG_CANDIDATE_LIMIT,
                language=language,
            )
            analysis = await summarize_text(
                polished_plain_text,
                title=polished_title,
                url=None,
                settings=settings,
                existing_tags=tag_candidates,
                language=language,
                max_tag_depth=TAG_MAX_DEPTH,
            )
            yield _sse_event(
                "done",
                {
                    "title": polished_title,
                    "content_html": polished_html,
                    "summary": analysis.summary,
                    "tags": analysis.tags,
                },
            )
        except Exception:
            yield _sse_event("error", {"message": "Apply polish failed"})

    headers = {
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }
    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers=headers,
    )


@router.post(
    "/create-note",
    response_model=CreateNoteResponse,
    status_code=status.HTTP_200_OK,
)
async def create_note(
    payload: CreateNoteRequest,
) -> CreateNoteResponse:
    content_html = (payload.content_html or "").strip()
    plain_text = html_to_text(content_html) or ""
    if not plain_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Note content is empty",
        )

    title = (payload.title or "").strip() or title_from_text(plain_text) or "Untitled"
    item_id = uuid.uuid4()
    url = f"note://{item_id}"
    normalized_url = normalize_url(url)
    skip_queue = bool(payload.skip_queue)

    if skip_queue and (payload.summary is None or payload.tags is None):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing summary or tags for skip_queue",
        )

    item = Item(
        id=item_id,
        url=url,
        normalized_url=normalized_url,
        source_type="note",
        title=title,
        content_text=content_html,
        content_format="html",
        processing_status="pending",
        content_revision=1,
        analysis_revision=0,
    )

    if skip_queue:
        async with async_session_factory() as session:
            async with session.begin():
                session.add(item)
            settings = await get_ai_settings(session)
        chunk_texts = chunk_text(plain_text) if plain_text else []
        embeddings = (
            await embed_texts(chunk_texts, settings=settings)
            if chunk_texts
            else []
        )
        await save_results(
            async_session_factory,
            item_id,
            title,
            content_html,
            plain_text,
            payload.summary or "",
            payload.tags or [],
            chunk_texts,
            embeddings,
        )
        async with async_session_factory() as update_session:
            async with update_session.begin():
                saved = await update_session.get(Item, item_id)
                if saved:
                    saved.processing_status = "completed"
                    saved.processing_target_revision = None

        return CreateNoteResponse(item_id=str(item_id), task_id=None, skipped=True)

    redis = get_redis()
    lock_key = _lock_key(normalized_url)
    try:
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

        try:
            async with async_session_factory() as session:
                async with session.begin():
                    session.add(item)
        except Exception:
            await redis.delete(lock_key)
            raise

        task = enqueue_process_item(str(item_id), lock_key)
        task_payload = json.dumps({"task_id": task.id, "item_id": str(item_id)})
        await redis.set(lock_key, task_payload, ex=LOCK_TTL_SECONDS)
        return CreateNoteResponse(item_id=str(item_id), task_id=task.id, skipped=False)
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
    plain_text = html_to_text(item.content_text)
    word_count, char_count = count_text_stats(plain_text)
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
            content_format=payload.content_format,
            title=payload.title,
        )
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    plain_text = html_to_text(item.content_text)
    word_count, char_count = count_text_stats(plain_text)
    return ItemDetailResponse.model_validate(item, from_attributes=True).model_copy(
        update={"word_count": word_count, "char_count": char_count}
    )
from app.models.item import Item
