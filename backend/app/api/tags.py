from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_session
from app.schemas.tags import TagTreeResponse
from app.services.tags_service import TagsService

router = APIRouter(prefix="/tags", tags=["Tags"])


@router.get("/tree", response_model=TagTreeResponse)
async def get_tag_tree(
    include_archived: bool = Query(default=True),
    session: AsyncSession = Depends(get_async_session),
) -> TagTreeResponse:
    service = TagsService(session)
    tree = await service.get_tag_tree(include_archived=include_archived)
    return TagTreeResponse(tree=tree)
