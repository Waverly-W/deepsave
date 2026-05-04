import os
import uuid

from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.ai.summarizer import (
    filter_tags_by_language,
    normalize_tag_path,
    normalize_tags,
)
from app.ai.tokenizer import tokenize_text
from app.models.item import Item
from app.models.item_chunk import ItemChunk
from app.models.item_tag import ItemTag
from app.models.tag import Tag
from app.utils.html import html_to_text

TAG_CANDIDATE_LIMIT = int(os.getenv("TAG_CANDIDATE_LIMIT", "200"))
TAG_MAX_DEPTH = int(os.getenv("TAG_MAX_DEPTH", "3"))


def title_from_text(content_text: str) -> str | None:
    for line in content_text.splitlines():
        trimmed = line.strip()
        if trimmed:
            return trimmed
    return None


async def save_results(
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
            await replace_item_tags(session, item_id, tags)
            await replace_item_chunks(session, item_id, chunk_texts, embeddings)
    return True


async def replace_item_tags(
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
        tag = await get_or_create_tag(session, normalized)
        session.add(ItemTag(item_id=item_id, tag_id=tag.id))


async def replace_item_chunks(
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


async def get_or_create_tag(
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


async def load_tag_candidates(
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
