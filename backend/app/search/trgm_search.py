from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.item import Item


async def search_by_trgm(
    session: AsyncSession,
    query: str,
    *,
    limit: int = 20,
    source_type: str | None = None,
) -> list[tuple[Item, float]]:
    needle = query.strip()
    if not needle:
        return []

    title_value = func.coalesce(Item.title, "")
    tags_value = func.coalesce(Item.cached_tags, "")

    title_sim = func.similarity(title_value, needle)
    tags_sim = func.similarity(tags_value, needle)
    score = func.greatest(title_sim, tags_sim).label("score")

    conditions = [Item.is_deleted.is_(False)]
    if source_type:
        conditions.append(Item.source_type == source_type)

    stmt = (
        select(Item, score)
        .where(title_value.op("%")(needle) | tags_value.op("%")(needle))
        .where(*conditions)
        .order_by(score.desc())
        .limit(limit)
    )
    result = await session.execute(stmt)
    return result.all()
