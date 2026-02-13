from __future__ import annotations

import os
import time
import uuid
from collections import OrderedDict

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.item import Item
from app.search import fuse_rrf, search_by_fts, search_by_trgm, search_by_vector

SEARCH_CACHE_TTL_S = max(int(os.getenv("SEARCH_CACHE_TTL_S", "30")), 0)
SEARCH_CACHE_MAX_KEYS = max(int(os.getenv("SEARCH_CACHE_MAX_KEYS", "256")), 0)
_search_cache: OrderedDict[str, tuple[float, list[tuple[str, float]]]] = OrderedDict()


class SearchService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def search(
        self,
        query: str,
        *,
        source_type: str | None = None,
        limit: int = 20,
    ) -> list[tuple[Item, float]]:
        cache_key = _make_cache_key(query, source_type, limit)
        cached = _cache_get(cache_key)
        if cached is not None:
            cached_items = await self._load_items_by_ids([item_id for item_id, _ in cached])
            results: list[tuple[Item, float]] = []
            for item_id, score in cached:
                item = cached_items.get(item_id)
                if item is not None:
                    results.append((item, score))
            if results:
                return results

        trgm_results = await search_by_trgm(
            self._session, query, limit=limit, source_type=source_type
        )
        fts_results = await search_by_fts(
            self._session, query, limit=limit, source_type=source_type
        )
        try:
            vector_results = await search_by_vector(
                self._session, query, limit=limit, source_type=source_type
            )
        except Exception:
            vector_results = []

        fused = fuse_rrf([trgm_results, fts_results, vector_results])
        result = fused[:limit]
        _cache_put(
            cache_key,
            [(str(item.id), float(score)) for item, score in result],
        )
        return result

    async def _load_items_by_ids(self, item_ids: list[str]) -> dict[str, Item]:
        if not item_ids:
            return {}
        parsed_ids = []
        for item_id in item_ids:
            try:
                parsed_ids.append(uuid.UUID(item_id))
            except ValueError:
                continue
        if not parsed_ids:
            return {}
        stmt = select(Item).where(Item.id.in_(parsed_ids))
        result = await self._session.execute(stmt)
        items = result.scalars().all()
        return {str(item.id): item for item in items}


def _make_cache_key(query: str, source_type: str | None, limit: int) -> str:
    return f"{query.strip().lower()}::{source_type or '*'}::{limit}"


def _cache_get(key: str) -> list[tuple[str, float]] | None:
    if SEARCH_CACHE_TTL_S <= 0 or SEARCH_CACHE_MAX_KEYS <= 0:
        return None
    entry = _search_cache.get(key)
    if entry is None:
        return None
    expires_at, payload = entry
    if expires_at < time.time():
        _search_cache.pop(key, None)
        return None
    _search_cache.move_to_end(key)
    return list(payload)


def _cache_put(key: str, payload: list[tuple[str, float]]) -> None:
    if SEARCH_CACHE_TTL_S <= 0 or SEARCH_CACHE_MAX_KEYS <= 0:
        return
    _search_cache[key] = (time.time() + SEARCH_CACHE_TTL_S, list(payload))
    _search_cache.move_to_end(key)
    while len(_search_cache) > SEARCH_CACHE_MAX_KEYS:
        _search_cache.popitem(last=False)
