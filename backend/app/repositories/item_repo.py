import uuid

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.item import Item


class ItemRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def upsert(
        self,
        *,
        url: str,
        normalized_url: str,
        source_type: str = "article",
        title: str | None = None,
        content_text: str | None = None,
        content_format: str | None = None,
    ) -> Item:
        values: dict[str, object] = {
            "url": url,
            "normalized_url": normalized_url,
            "source_type": source_type,
            "is_deleted": False,
            "is_archived": False,
        }
        if title is not None:
            values["title"] = title
        if content_text is not None:
            values["content_text"] = content_text
            values["content_revision"] = 1
            values["content_format"] = content_format or "html"
            values["processing_target_revision"] = 1
        else:
            values["processing_target_revision"] = 0

        update_values: dict[str, object] = {
            "url": url,
            "source_type": source_type,
            "processing_status": "pending",
            "is_deleted": False,
            "is_archived": False,
            "updated_at": func.now(),
            "processing_target_revision": Item.content_revision,
        }
        if title is not None:
            update_values["title"] = title
        if content_text is not None:
            update_values["content_text"] = content_text
            update_values["content_revision"] = Item.content_revision + 1
            update_values["content_format"] = content_format or "html"
            update_values["processing_target_revision"] = Item.content_revision + 1

        stmt = (
            insert(Item)
            .values(**values)
            .on_conflict_do_update(
                index_elements=[Item.normalized_url],
                set_=update_values,
            )
            .returning(Item)
        )
        result = await self._session.execute(stmt)
        return result.scalar_one()

    async def get_by_id(self, item_id: uuid.UUID) -> Item | None:
        result = await self._session.execute(select(Item).where(Item.id == item_id))
        return result.scalar_one_or_none()

    async def update(self, item: Item, **kwargs: object) -> Item:
        for key, value in kwargs.items():
            setattr(item, key, value)
        await self._session.flush()
        await self._session.refresh(item)
        return item
