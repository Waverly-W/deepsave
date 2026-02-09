from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.item import Item


async def search_by_fts(
    session: AsyncSession,
    query: str,
    *,
    limit: int = 20,
    source_type: str | None = None,
) -> list[tuple[Item, float]]:
    needle = query.strip()
    if not needle:
        return []

    ts_query = func.websearch_to_tsquery("simple", needle)
    rank = func.ts_rank(Item.content_search_vector, ts_query).label("score")

    conditions = [
        Item.is_deleted.is_(False),
        Item.content_search_vector.op("@@")(ts_query),
    ]
    if source_type:
        conditions.append(Item.source_type == source_type)

    stmt = (
        select(Item, rank)
        .where(*conditions)
        .order_by(rank.desc())
        .limit(limit)
    )
    result = await session.execute(stmt)
    return result.all()
