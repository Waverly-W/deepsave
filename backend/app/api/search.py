from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_auth
from app.core.database import get_async_session
from app.schemas.search import SearchResponse, SearchResultItem
from app.services.search_service import SearchService
from app.utils.html import html_to_text
from app.utils.text_stats import count_text_stats

router = APIRouter(tags=["Search"], dependencies=[Depends(require_auth)])


@router.get("/search", response_model=SearchResponse)
async def search(
    q: str = Query(min_length=1),
    source_type: str | None = Query(default=None, alias="type"),
    limit: int = Query(default=20, ge=1, le=50),
    session: AsyncSession = Depends(get_async_session),
) -> SearchResponse:
    service = SearchService(session)
    results = await service.search(q, source_type=source_type, limit=limit)

    items = []
    for item, score in results:
        plain_text = html_to_text(item.content_text)
        word_count, char_count = count_text_stats(plain_text)
        items.append(
            SearchResultItem.model_validate(item, from_attributes=True).model_copy(
                update={
                    "rrf_score": score,
                    "word_count": word_count,
                    "char_count": char_count,
                }
            )
        )
    return SearchResponse(query=q, count=len(items), items=items)
