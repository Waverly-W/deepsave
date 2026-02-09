from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.embedding import embed_texts
from app.models.item import Item
from app.models.item_chunk import ItemChunk


async def search_by_vector(
    session: AsyncSession,
    query: str,
    *,
    limit: int = 20,
    source_type: str | None = None,
    candidate_multiplier: int = 5,
) -> list[tuple[Item, float]]:
    needle = query.strip()
    if not needle:
        return []

    vectors = await embed_texts([needle])
    if not vectors or not vectors[0]:
        return []

    distance = ItemChunk.embedding.cosine_distance(vectors[0]).label("distance")
    conditions = [Item.is_deleted.is_(False)]
    if source_type:
        conditions.append(Item.source_type == source_type)

    candidate_limit = max(limit * candidate_multiplier, limit)
    stmt = (
        select(Item, distance)
        .join(ItemChunk, ItemChunk.item_id == Item.id)
        .where(*conditions)
        .order_by(distance.asc())
        .limit(candidate_limit)
    )
    result = await session.execute(stmt)

    rows = result.all()
    seen: set[object] = set()
    deduped: list[tuple[Item, float]] = []
    for item, dist in rows:
        if item.id in seen:
            continue
        seen.add(item.id)
        deduped.append((item, float(dist)))
        if len(deduped) >= limit:
            break
    return deduped
