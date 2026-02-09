from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.item import Item
from app.search import fuse_rrf, search_by_fts, search_by_trgm, search_by_vector


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
        return fused[:limit]
