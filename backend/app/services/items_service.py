from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import NotFoundError
from app.ai.tokenizer import tokenize_text
from app.utils.html import html_to_text
from app.models.item import Item
from app.repositories.item_repo import ItemRepository


class ItemsService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._items = ItemRepository(session)

    async def list_items(
        self,
        *,
        cursor: datetime | None = None,
        limit: int = 20,
        source_type: str | None = None,
        archived: bool = False,
    ) -> tuple[list[Item], datetime | None]:
        conditions = [Item.is_deleted.is_(False)]
        if archived:
            conditions.append(Item.is_archived.is_(True))
        else:
            conditions.append(Item.is_archived.is_(False))

        if source_type:
            conditions.append(Item.source_type == source_type)

        if cursor:
            conditions.append(Item.created_at < cursor)

        stmt = (
            select(Item)
            .where(*conditions)
            .order_by(Item.created_at.desc(), Item.id.desc())
            .limit(limit + 1)
        )
        result = await self._session.execute(stmt)
        items = list(result.scalars().all())

        next_cursor = None
        if len(items) > limit:
            items = items[:limit]
            next_cursor = items[-1].created_at if items else None

        return items, next_cursor

    async def get_item(self, item_id: uuid.UUID) -> Item:
        item = await self._items.get_by_id(item_id)
        if item is None:
            raise NotFoundError("Item not found")
        return item

    async def update_item(
        self,
        item_id: uuid.UUID,
        *,
        is_archived: bool | None = None,
        is_deleted: bool | None = None,
        is_read: bool | None = None,
        content_text: str | None = None,
        content_format: str | None = None,
        title: str | None = None,
    ) -> Item:
        item = await self.get_item(item_id)
        updates: dict[str, object] = {}
        if is_archived is not None:
            updates["is_archived"] = is_archived
        if is_deleted is not None:
            updates["is_deleted"] = is_deleted
        if is_read is not None:
            updates["is_read"] = is_read
        if title is not None:
            updates["title"] = title
        if content_format is not None:
            updates["content_format"] = content_format
        if content_text is not None and content_text != item.content_text:
            updates["content_text"] = content_text
            plain_text = html_to_text(content_text)
            updates["content_tokens"] = tokenize_text(plain_text)
            updates["content_revision"] = (item.content_revision or 0) + 1
            updates["content_format"] = content_format or "html"
        if not updates:
            return item
        return await self._items.update(item, **updates)

    async def get_overview(self, *, top_tags_limit: int = 8) -> dict[str, object]:
        conditions = [Item.is_deleted.is_(False), Item.is_archived.is_(False)]
        start_of_day = datetime.now(timezone.utc).replace(
            hour=0, minute=0, second=0, microsecond=0
        )

        stats_stmt = (
            select(
                func.count().label("total_count"),
                func.count().filter(Item.is_read.is_(False)).label("unread_count"),
                func.count()
                .filter(Item.processing_status.in_(["pending", "processing"]))
                .label("processing_count"),
                func.count()
                .filter(Item.content_revision > Item.analysis_revision)
                .label("stale_count"),
                func.count().filter(Item.created_at >= start_of_day).label("today_count"),
                func.max(Item.created_at).label("latest_created_at"),
            )
            .where(*conditions)
        )
        stats_row = (await self._session.execute(stats_stmt)).one()

        tag = func.unnest(func.string_to_array(Item.cached_tags, " ")).label("tag")
        tags_subquery = (
            select(tag)
            .where(*conditions)
            .where(Item.cached_tags.is_not(None))
            .where(Item.cached_tags != "")
        ).subquery()
        tags_stmt = (
            select(tags_subquery.c.tag, func.count().label("count"))
            .where(tags_subquery.c.tag != "")
            .group_by(tags_subquery.c.tag)
            .order_by(func.count().desc(), tags_subquery.c.tag.asc())
            .limit(top_tags_limit)
        )
        tag_rows = (await self._session.execute(tags_stmt)).all()
        top_tags = [{"tag": row.tag, "count": row.count} for row in tag_rows]

        return {
            "total_count": stats_row.total_count or 0,
            "unread_count": stats_row.unread_count or 0,
            "processing_count": stats_row.processing_count or 0,
            "stale_count": stats_row.stale_count or 0,
            "today_count": stats_row.today_count or 0,
            "latest_created_at": stats_row.latest_created_at,
            "top_tags": top_tags,
        }
