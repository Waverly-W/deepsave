from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_auth
from app.core.database import get_async_session
from app.schemas.tags import GraphMode, RelationGraphResponse, TagGraphResponse, TagTreeResponse
from app.services.tags_service import TagsService

router = APIRouter(
    prefix="/tags",
    tags=["Tags"],
    dependencies=[Depends(require_auth)],
)


@router.get("/tree", response_model=TagTreeResponse)
async def get_tag_tree(
    include_archived: bool = Query(default=True),
    session: AsyncSession = Depends(get_async_session),
) -> TagTreeResponse:
    service = TagsService(session)
    tree = await service.get_tag_tree(include_archived=include_archived)
    return TagTreeResponse(tree=tree)


@router.get("/graph", response_model=TagGraphResponse)
async def get_tag_graph(
    center_tag: str = Query(min_length=1),
    max_neighbors: int = Query(default=12, ge=1, le=30),
    min_weight: float = Query(default=0.1, ge=0.0, le=1.0),
    include_archived: bool = Query(default=False),
    days: int | None = Query(default=None, ge=1),
    session: AsyncSession = Depends(get_async_session),
) -> TagGraphResponse:
    service = TagsService(session)
    resolved_center, nodes, edges = await service.get_tag_graph(
        center_tag=center_tag,
        max_neighbors=max_neighbors,
        min_weight=min_weight,
        include_archived=include_archived,
        days=days,
    )
    return TagGraphResponse(
        center_tag=resolved_center,
        node_count=len(nodes),
        edge_count=len(edges),
        nodes=nodes,
        edges=edges,
    )


@router.get("/network", response_model=RelationGraphResponse)
async def get_relation_graph(
    mode: GraphMode = Query(default="tag"),
    include_archived: bool = Query(default=False),
    days: int | None = Query(default=None, ge=1),
    max_nodes: int = Query(default=300, ge=10, le=2000),
    max_edges: int = Query(default=1500, ge=10, le=5000),
    min_shared: int = Query(default=1, ge=1, le=20),
    session: AsyncSession = Depends(get_async_session),
) -> RelationGraphResponse:
    service = TagsService(session)
    nodes, edges = await service.get_relation_graph(
        mode=mode,
        include_archived=include_archived,
        days=days,
        max_nodes=max_nodes,
        max_edges=max_edges,
        min_shared=min_shared,
    )
    return RelationGraphResponse(
        mode=mode,
        node_count=len(nodes),
        edge_count=len(edges),
        nodes=nodes,
        edges=edges,
    )
