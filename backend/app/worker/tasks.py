import asyncio
import json
import os
import uuid
from datetime import datetime, timedelta, timezone

import httpx
import trafilatura
from sqlalchemy import delete, func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.ai.chunking import chunk_text
from app.ai.embedding import embed_texts
from app.ai.polisher import PolishResult, polish_text
from app.ai.summarizer import (
    detect_language,
    filter_tags_by_language,
    normalize_tag_path,
    normalize_tags,
    summarize_text,
)
from app.ai.tokenizer import tokenize_text
from app.ai.vision import describe_image, extract_palette
from app.core.ai_settings import get_ai_settings
from app.core.database import DATABASE_URL
from app.core.redis import get_redis
from app.models.item import Item
from app.models.item_chunk import ItemChunk
from app.models.item_tag import ItemTag
from app.models.tag import Tag
from app.models.task_log import TaskLog
from app.scraper.smart_scraper import scrape_url
from app.utils.html import html_to_text
from app.utils.markdown import markdown_to_html
from app.worker.celery_app import celery_app

GLOBAL_LOCK_KEY = "processing:global"
GLOBAL_LOCK_TTL_SECONDS = int(os.getenv("PROCESSING_GLOBAL_LOCK_TTL_S", "900"))
GLOBAL_LOCK_RETRY_SECONDS = float(os.getenv("PROCESSING_GLOBAL_LOCK_RETRY_S", "5"))
ITEM_LOCK_TTL_SECONDS = int(os.getenv("INGEST_LOCK_TTL_S", "600"))
TAG_CANDIDATE_LIMIT = int(os.getenv("TAG_CANDIDATE_LIMIT", "200"))
TAG_MAX_DEPTH = int(os.getenv("TAG_MAX_DEPTH", "3"))


@celery_app.task(name="items.process")
def process_item(item_id: str, lock_key: str | None = None) -> None:
    asyncio.run(_process_item_async(item_id, lock_key))


@celery_app.task(name="items.process_content")
def process_item_content(item_id: str, lock_key: str | None = None) -> None:
    asyncio.run(_process_item_content_async(item_id, lock_key))


@celery_app.task(name="items.polish_content")
def polish_item_content(item_id: str, lock_key: str | None = None) -> None:
    asyncio.run(_polish_item_content_async(item_id, lock_key))


async def _process_item_async(item_id: str, lock_key: str | None) -> None:
    item_uuid = uuid.UUID(item_id)
    expected_revision = 0
    redis = get_redis()
    global_token = str(uuid.uuid4())
    acquired = await redis.set(
        GLOBAL_LOCK_KEY,
        global_token,
        nx=True,
        ex=GLOBAL_LOCK_TTL_SECONDS,
    )
    if not acquired:
        await _requeue_due_to_global_lock(item_uuid, lock_key, redis, process_item)
        await redis.close()
        return

    engine = create_async_engine(DATABASE_URL, pool_pre_ping=True)
    session_factory = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    try:
        item = await _load_item(session_factory, item_uuid)
        if item is None:
            raise ValueError("Item not found")
        expected_revision = item.content_revision or 0
        await _mark_processing(session_factory, item_uuid, expected_revision)

        settings = await _load_ai_settings(session_factory)
        if item.source_type == "note":
            content_text = item.content_text or ""
            plain_text = html_to_text(content_text) or ""
            title = item.title or _title_from_text(plain_text) or item.url
            language = detect_language(plain_text, title)
            polish = await polish_text(
                plain_text,
                title=title,
                url=item.url,
                settings=settings,
                language=language,
            )
            polished_title, polished_content_text, polished_plain_text = _apply_polish_result(
                title=title,
                content_text=content_text,
                plain_text=plain_text,
                polish=polish,
            )
            tag_candidates = await _load_tag_candidates(
                session_factory,
                limit=TAG_CANDIDATE_LIMIT,
                language=language,
            )
            analysis = await summarize_text(
                polished_plain_text,
                title=polished_title,
                url=item.url,
                settings=settings,
                existing_tags=tag_candidates,
                language=language,
                max_tag_depth=TAG_MAX_DEPTH,
            )

            chunk_texts = (
                chunk_text(polished_plain_text) if polished_plain_text else []
            )
            embeddings = (
                await embed_texts(chunk_texts, settings=settings) if chunk_texts else []
            )

            await _save_results(
                session_factory,
                item_uuid,
                polished_title,
                polished_content_text,
                polished_plain_text,
                analysis.summary,
                analysis.tags,
                chunk_texts,
                embeddings,
                expected_revision,
            )
        elif item.source_type == "image":
            title = item.title or item.url
            image_bytes = await _fetch_image_bytes(item.url)
            description = await describe_image(image_bytes, settings=settings)
            palette = extract_palette(image_bytes)
            chunk_texts = chunk_text(description) if description else []
            embeddings = (
                await embed_texts(chunk_texts, settings=settings) if chunk_texts else []
            )
            await _save_image_results(
                session_factory,
                item_uuid,
                title,
                description,
                palette,
                chunk_texts,
                embeddings,
                expected_revision,
            )
        else:
            scrape = await scrape_url(item.url, item_id=item_id)
            content_text = scrape.content_text
            if not content_text and scrape.html:
                content_text = trafilatura.extract(
                    scrape.html, include_comments=False, include_tables=False
                )

            title = scrape.title or item.title or item.url
            content_text = markdown_to_html(content_text) if content_text else None
            plain_text = html_to_text(content_text) or ""
            language = detect_language(plain_text, title)
            polish = await polish_text(
                plain_text,
                title=title,
                url=item.url,
                settings=settings,
                language=language,
            )
            polished_title, polished_content_text, polished_plain_text = _apply_polish_result(
                title=title,
                content_text=content_text,
                plain_text=plain_text,
                polish=polish,
            )
            tag_candidates = await _load_tag_candidates(
                session_factory,
                limit=TAG_CANDIDATE_LIMIT,
                language=language,
            )
            analysis = await summarize_text(
                polished_plain_text,
                title=polished_title,
                url=item.url,
                settings=settings,
                existing_tags=tag_candidates,
                language=language,
                max_tag_depth=TAG_MAX_DEPTH,
            )

            chunk_texts = (
                chunk_text(polished_plain_text) if polished_plain_text else []
            )
            embeddings = (
                await embed_texts(chunk_texts, settings=settings) if chunk_texts else []
            )

            await _save_results(
                session_factory,
                item_uuid,
                polished_title,
                polished_content_text,
                polished_plain_text,
                analysis.summary,
                analysis.tags,
                chunk_texts,
                embeddings,
                expected_revision,
            )
        await _mark_completed(session_factory, item_uuid, expected_revision)
    except Exception:
        await _mark_failed(session_factory, item_uuid, expected_revision)
        raise
    finally:
        await _release_global_lock(redis, global_token)
        if lock_key:
            await redis.delete(lock_key)
        await redis.close()
        await engine.dispose()


async def _process_item_content_async(item_id: str, lock_key: str | None) -> None:
    item_uuid = uuid.UUID(item_id)
    expected_revision = 0
    redis = get_redis()
    global_token = str(uuid.uuid4())
    acquired = await redis.set(
        GLOBAL_LOCK_KEY,
        global_token,
        nx=True,
        ex=GLOBAL_LOCK_TTL_SECONDS,
    )
    if not acquired:
        await _requeue_due_to_global_lock(item_uuid, lock_key, redis, process_item_content)
        await redis.close()
        return

    engine = create_async_engine(DATABASE_URL, pool_pre_ping=True)
    session_factory = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    try:
        item = await _load_item(session_factory, item_uuid)
        if item is None:
            raise ValueError("Item not found")

        expected_revision = (
            item.processing_target_revision
            if item.processing_target_revision is not None
            else (item.content_revision or 0)
        )
        await _mark_processing(session_factory, item_uuid, expected_revision)

        content_text = item.content_text or ""
        plain_text = html_to_text(content_text) or ""
        title = item.title or _title_from_text(plain_text) or item.url
        settings = await _load_ai_settings(session_factory)
        language = detect_language(plain_text, title)
        tag_candidates = await _load_tag_candidates(
            session_factory,
            limit=TAG_CANDIDATE_LIMIT,
            language=language,
        )
        analysis = await summarize_text(
            plain_text,
            title=title,
            url=item.url,
            settings=settings,
            existing_tags=tag_candidates,
            language=language,
            max_tag_depth=TAG_MAX_DEPTH,
        )

        chunk_texts = chunk_text(plain_text) if plain_text else []
        embeddings = (
            await embed_texts(chunk_texts, settings=settings) if chunk_texts else []
        )

        await _save_results(
            session_factory,
            item_uuid,
            title,
            content_text,
            plain_text,
            analysis.summary,
            analysis.tags,
            chunk_texts,
            embeddings,
            expected_revision,
        )
        await _mark_completed(session_factory, item_uuid, expected_revision)
    except Exception:
        await _mark_failed(session_factory, item_uuid, expected_revision)
        raise
    finally:
        await _release_global_lock(redis, global_token)
        if lock_key:
            await redis.delete(lock_key)
        await redis.close()
        await engine.dispose()


async def _polish_item_content_async(item_id: str, lock_key: str | None) -> None:
    item_uuid = uuid.UUID(item_id)
    expected_revision = 0
    redis = get_redis()
    global_token = str(uuid.uuid4())
    acquired = await redis.set(
        GLOBAL_LOCK_KEY,
        global_token,
        nx=True,
        ex=GLOBAL_LOCK_TTL_SECONDS,
    )
    if not acquired:
        await _requeue_due_to_global_lock(item_uuid, lock_key, redis, polish_item_content)
        await redis.close()
        return

    engine = create_async_engine(DATABASE_URL, pool_pre_ping=True)
    session_factory = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    try:
        item = await _load_item(session_factory, item_uuid)
        if item is None:
            raise ValueError("Item not found")

        expected_revision = (
            item.processing_target_revision
            if item.processing_target_revision is not None
            else (item.content_revision or 0)
        )
        await _mark_processing(session_factory, item_uuid, expected_revision)

        if item.source_type == "image":
            await _mark_completed(session_factory, item_uuid, expected_revision)
            return

        content_text = item.content_text or ""
        plain_text = html_to_text(content_text) or ""
        title = item.title or _title_from_text(plain_text) or item.url
        settings = await _load_ai_settings(session_factory)
        language = detect_language(plain_text, title)
        polish = await polish_text(
            plain_text,
            title=title,
            url=item.url,
            settings=settings,
            language=language,
        )
        polished_title, polished_content_text, polished_plain_text = _apply_polish_result(
            title=title,
            content_text=content_text,
            plain_text=plain_text,
            polish=polish,
        )

        tag_candidates = await _load_tag_candidates(
            session_factory,
            limit=TAG_CANDIDATE_LIMIT,
            language=language,
        )
        analysis = await summarize_text(
            polished_plain_text,
            title=polished_title,
            url=item.url,
            settings=settings,
            existing_tags=tag_candidates,
            language=language,
            max_tag_depth=TAG_MAX_DEPTH,
        )

        chunk_texts = chunk_text(polished_plain_text) if polished_plain_text else []
        embeddings = (
            await embed_texts(chunk_texts, settings=settings) if chunk_texts else []
        )

        await _save_results(
            session_factory,
            item_uuid,
            polished_title,
            polished_content_text,
            polished_plain_text,
            analysis.summary,
            analysis.tags,
            chunk_texts,
            embeddings,
            expected_revision,
        )
        await _mark_completed(session_factory, item_uuid, expected_revision)
    except Exception:
        await _mark_failed(session_factory, item_uuid, expected_revision)
        raise
    finally:
        await _release_global_lock(redis, global_token)
        if lock_key:
            await redis.delete(lock_key)
        await redis.close()
        await engine.dispose()


def _apply_polish_result(
    *,
    title: str,
    content_text: str | None,
    plain_text: str,
    polish: PolishResult,
) -> tuple[str, str | None, str]:
    if polish.fallback_reason:
        return title, content_text, plain_text
    markdown = (polish.content_markdown or "").strip()
    if not markdown:
        return title, content_text, plain_text
    polished_html = markdown_to_html(markdown)
    if not polished_html:
        return title, content_text, plain_text
    polished_title = (polish.title or "").strip() or title
    polished_plain_text = html_to_text(polished_html) or ""
    return polished_title, polished_html, polished_plain_text


def _title_from_text(content_text: str) -> str | None:
    for line in content_text.splitlines():
        trimmed = line.strip()
        if trimmed:
            return trimmed
    return None


@celery_app.task(name="maintenance.cleanup")
def cleanup_maintenance() -> None:
    asyncio.run(_cleanup_maintenance_async())


async def _cleanup_maintenance_async() -> None:
    engine = create_async_engine(DATABASE_URL, pool_pre_ping=True)
    session_factory = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    recycle_days = int(os.getenv("RECYCLE_BIN_RETENTION_DAYS", "30"))
    log_days = int(os.getenv("TASK_LOG_RETENTION_DAYS", "7"))
    now = datetime.now(timezone.utc)
    recycle_cutoff = now - timedelta(days=recycle_days)
    log_cutoff = now - timedelta(days=log_days)

    try:
        async with session_factory() as session:
            async with session.begin():
                await session.execute(
                    delete(Item).where(
                        Item.is_deleted.is_(True),
                        Item.updated_at < recycle_cutoff,
                    )
                )
                await session.execute(
                    delete(TaskLog).where(TaskLog.created_at < log_cutoff)
                )
    finally:
        await engine.dispose()

async def _mark_processing(
    session_factory: async_sessionmaker[AsyncSession],
    item_id: uuid.UUID,
    expected_revision: int,
) -> None:
    async with session_factory() as session:
        async with session.begin():
            await session.execute(
                update(Item)
                .where(Item.id == item_id)
                .where(
                    (Item.processing_target_revision.is_(None))
                    | (Item.processing_target_revision == expected_revision)
                )
                .values(
                    processing_status="processing",
                    processing_target_revision=expected_revision,
                    updated_at=func.now(),
                )
            )


async def _mark_completed(
    session_factory: async_sessionmaker[AsyncSession],
    item_id: uuid.UUID,
    expected_revision: int,
) -> None:
    async with session_factory() as session:
        async with session.begin():
            await session.execute(
                update(Item)
                .where(Item.id == item_id)
                .where(Item.processing_target_revision == expected_revision)
                .values(
                    processing_status="completed",
                    processing_target_revision=None,
                    updated_at=func.now(),
                )
            )


async def _mark_failed(
    session_factory: async_sessionmaker[AsyncSession],
    item_id: uuid.UUID,
    expected_revision: int,
) -> None:
    async with session_factory() as session:
        async with session.begin():
            await session.execute(
                update(Item)
                .where(Item.id == item_id)
                .where(Item.processing_target_revision == expected_revision)
                .values(
                    processing_status="failed",
                    processing_target_revision=None,
                    updated_at=func.now(),
                )
            )


async def _load_item(
    session_factory: async_sessionmaker[AsyncSession],
    item_id: uuid.UUID,
) -> Item | None:
    async with session_factory() as session:
        result = await session.execute(select(Item).where(Item.id == item_id))
        return result.scalar_one_or_none()


async def _save_results(
    session_factory: async_sessionmaker[AsyncSession],
    item_id: uuid.UUID,
    title: str,
    content_text: str | None,
    plain_text: str | None,
    summary: str,
    tags: list[str],
    chunk_texts: list[str],
    embeddings: list[list[float]],
    expected_revision: int | None = None,
) -> bool:
    cached_tags = " ".join(tags) if tags else None
    if plain_text is None:
        plain_text = html_to_text(content_text)
    content_tokens = tokenize_text(plain_text)
    async with session_factory() as session:
        async with session.begin():
            item = await session.get(Item, item_id)
            if item is None:
                raise ValueError("Item not found")
            if expected_revision is not None and item.content_revision != expected_revision:
                return False
            content_changed = content_text != item.content_text
            new_revision = item.content_revision or 0
            if content_changed:
                new_revision += 1
            item.title = title
            item.summary = summary
            item.content_text = content_text
            item.content_format = "html"
            item.content_tokens = content_tokens
            item.cached_tags = cached_tags
            item.content_revision = new_revision
            item.analysis_revision = new_revision
            await _replace_item_tags(session, item_id, tags)
            await _replace_item_chunks(session, item_id, chunk_texts, embeddings)
    return True


async def _save_image_results(
    session_factory: async_sessionmaker[AsyncSession],
    item_id: uuid.UUID,
    title: str,
    description: str,
    palette: list[str],
    chunk_texts: list[str],
    embeddings: list[list[float]],
    expected_revision: int | None = None,
) -> bool:
    html_description = markdown_to_html(description) if description else None
    content_tokens = tokenize_text(description)
    async with session_factory() as session:
        async with session.begin():
            item = await session.get(Item, item_id)
            if item is None:
                raise ValueError("Item not found")
            if expected_revision is not None and item.content_revision != expected_revision:
                return False
            content_changed = html_description != item.content_text
            new_revision = item.content_revision or 0
            if content_changed:
                new_revision += 1
            item.title = title
            item.summary = description
            item.content_text = html_description
            item.content_tokens = content_tokens
            item.cached_tags = None
            item.content_revision = new_revision
            item.analysis_revision = new_revision
            item.content_format = "html"
            meta = dict(item.meta_json or {})
            meta.update({"description": description, "palette": palette})
            item.meta_json = meta
            await _replace_item_tags(session, item_id, [])
            await _replace_item_chunks(session, item_id, chunk_texts, embeddings)
    return True


async def _replace_item_tags(
    session: AsyncSession,
    item_id: uuid.UUID,
    tags: list[str],
) -> None:
    await session.execute(delete(ItemTag).where(ItemTag.item_id == item_id))
    if not tags:
        return

    for name in tags:
        normalized = normalize_tag_path(name, max_depth=TAG_MAX_DEPTH)
        if not normalized:
            continue
        tag = await _get_or_create_tag(session, normalized)
        session.add(ItemTag(item_id=item_id, tag_id=tag.id))


async def _replace_item_chunks(
    session: AsyncSession,
    item_id: uuid.UUID,
    chunk_texts: list[str],
    embeddings: list[list[float]],
) -> None:
    await session.execute(delete(ItemChunk).where(ItemChunk.item_id == item_id))

    if not chunk_texts:
        return

    if len(chunk_texts) != len(embeddings):
        raise ValueError("Chunk count does not match embeddings")

    for index, (chunk_text, vector) in enumerate(zip(chunk_texts, embeddings)):
        session.add(
            ItemChunk(
                item_id=item_id,
                chunk_index=index,
                chunk_text=chunk_text,
                embedding=vector,
            )
        )


async def _get_or_create_tag(
    session: AsyncSession,
    path: str,
    category: str = "general",
) -> Tag:
    cleaned = path.strip()
    if not cleaned:
        raise ValueError("Tag path cannot be empty")

    parts = [part for part in cleaned.split("/") if part]
    if not parts:
        raise ValueError("Tag path cannot be empty")

    parent_id: int | None = None
    tag: Tag | None = None
    current_path = ""
    for depth, segment in enumerate(parts, start=1):
        current_path = segment if not current_path else f"{current_path}/{segment}"
        result = await session.execute(
            select(Tag).where(Tag.path == current_path, Tag.category == category)
        )
        tag = result.scalar_one_or_none()
        if tag is None:
            async with session.begin_nested():
                tag = Tag(
                    name=segment,
                    path=current_path,
                    depth=depth,
                    parent_id=parent_id,
                    category=category,
                )
                session.add(tag)
                try:
                    await session.flush()
                except IntegrityError:
                    pass
            result = await session.execute(
                select(Tag).where(Tag.path == current_path, Tag.category == category)
            )
            tag = result.scalar_one()
        parent_id = tag.id

    if tag is None:
        raise ValueError("Tag path cannot be empty")
    return tag


async def _load_ai_settings(
    session_factory: async_sessionmaker[AsyncSession],
):
    async with session_factory() as session:
        return await get_ai_settings(session)


async def _load_tag_candidates(
    session_factory: async_sessionmaker[AsyncSession],
    *,
    limit: int,
    language: str | None,
) -> list[str]:
    if limit <= 0:
        return []
    async with session_factory() as session:
        stmt = (
            select(Tag.path, func.count(ItemTag.tag_id).label("count"))
            .join(ItemTag, ItemTag.tag_id == Tag.id)
            .join(Item, Item.id == ItemTag.item_id)
            .where(Item.is_deleted.is_(False))
            .group_by(Tag.path)
            .order_by(func.count().desc(), Tag.path.asc())
            .limit(limit)
        )
        rows = (await session.execute(stmt)).all()
    candidates = [row.path for row in rows if row.path]
    candidates = normalize_tags(candidates, max_depth=TAG_MAX_DEPTH)
    candidates = filter_tags_by_language(candidates, language)
    return candidates


async def _fetch_image_bytes(url: str) -> bytes:
    timeout = float(os.getenv("IMAGE_FETCH_TIMEOUT_S", "30"))
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.get(url)
        response.raise_for_status()
        return response.content


async def _requeue_due_to_global_lock(
    item_id: uuid.UUID,
    lock_key: str | None,
    redis,
    task_func,
) -> None:
    countdown = max(int(GLOBAL_LOCK_RETRY_SECONDS), 1)
    task = task_func.apply_async(args=[str(item_id), lock_key], countdown=countdown)
    if lock_key:
        payload = json.dumps({"task_id": task.id, "item_id": str(item_id)})
        await redis.set(lock_key, payload, ex=ITEM_LOCK_TTL_SECONDS)


async def _release_global_lock(redis, token: str) -> None:
    current = await redis.get(GLOBAL_LOCK_KEY)
    if current == token:
        await redis.delete(GLOBAL_LOCK_KEY)
