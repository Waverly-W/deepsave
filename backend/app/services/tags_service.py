from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone
import math

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.models.item import Item
from app.models.item_tag import ItemTag
from app.models.tag import Tag
from app.schemas.tags import (
    GraphMode,
    RelationGraphEdge,
    RelationGraphNode,
    TagGraphEdge,
    TagGraphNode,
    TagTreeItem,
    TagTreeNode,
)


class TagsService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_tag_tree(self, *, include_archived: bool = True) -> list[TagTreeNode]:
        result = await self._session.execute(
            select(Tag).order_by(Tag.depth.asc(), func.lower(Tag.name).asc(), Tag.id.asc())
        )
        tags = list(result.scalars().all())
        if not tags:
            return []

        children_map: dict[int, list[Tag]] = defaultdict(list)
        for tag in tags:
            if tag.parent_id is not None:
                children_map[tag.parent_id].append(tag)
            children_map.setdefault(tag.id, [])

        leaf_ids = [tag.id for tag in tags if not children_map.get(tag.id)]
        items_map: dict[int, list[TagTreeItem]] = defaultdict(list)
        if leaf_ids:
            stmt = (
                select(ItemTag.tag_id, Item)
                .join(Item, Item.id == ItemTag.item_id)
                .where(ItemTag.tag_id.in_(leaf_ids))
                .where(Item.is_deleted.is_(False))
            )
            if not include_archived:
                stmt = stmt.where(Item.is_archived.is_(False))
            stmt = stmt.order_by(Item.updated_at.desc(), Item.id.asc())

            rows = (await self._session.execute(stmt)).all()
            for tag_id, item in rows:
                items_map[tag_id].append(
                    TagTreeItem(
                        id=item.id,
                        title=item.title,
                        updated_at=item.updated_at,
                        is_read=item.is_read,
                        source_type=item.source_type,
                    )
                )

        def sort_key(tag: Tag) -> tuple[str, int]:
            return (tag.name.lower(), tag.id)

        def build_node(tag: Tag) -> TagTreeNode:
            children_tags = sorted(children_map.get(tag.id, []), key=sort_key)
            return TagTreeNode(
                id=tag.id,
                name=tag.name,
                path=tag.path,
                depth=tag.depth,
                children=[build_node(child) for child in children_tags],
                items=items_map.get(tag.id, []),
            )

        def prune(node: TagTreeNode) -> TagTreeNode | None:
            pruned_children = []
            for child in node.children:
                kept = prune(child)
                if kept:
                    pruned_children.append(kept)
            node.children = pruned_children
            if node.items or node.children:
                return node
            return None

        roots = sorted([tag for tag in tags if tag.parent_id is None], key=sort_key)
        pruned_roots: list[TagTreeNode] = []
        for tag in roots:
            built = build_node(tag)
            kept = prune(built)
            if kept:
                pruned_roots.append(kept)
        return pruned_roots

    async def get_tag_graph(
        self,
        *,
        center_tag: str,
        max_neighbors: int = 12,
        min_weight: float = 0.1,
        include_archived: bool = False,
        days: int | None = None,
    ) -> tuple[str, list[TagGraphNode], list[TagGraphEdge]]:
        normalized_center = center_tag.strip()
        if not normalized_center:
            return "", [], []

        center_result = await self._session.execute(
            select(Tag).where(func.lower(Tag.path) == normalized_center.lower()).limit(1)
        )
        center = center_result.scalar_one_or_none()
        if center is None:
            return normalized_center, [], []

        filters = [Item.is_deleted.is_(False)]
        if not include_archived:
            filters.append(Item.is_archived.is_(False))
        if days is not None:
            start_at = datetime.now(timezone.utc) - timedelta(days=days)
            filters.append(Item.created_at >= start_at)

        filtered_items = select(Item.id.label("item_id")).where(*filters).subquery()

        center_items = (
            select(ItemTag.item_id.label("item_id"))
            .join(filtered_items, filtered_items.c.item_id == ItemTag.item_id)
            .where(ItemTag.tag_id == center.id)
            .distinct()
            .subquery()
        )

        center_count = int(
            (
                await self._session.execute(
                    select(func.count()).select_from(center_items)
                )
            ).scalar_one()
            or 0
        )

        center_path = center.path
        center_node = TagGraphNode(
            id=center_path,
            label=center_path,
            count=center_count,
            is_center=True,
        )
        if center_count == 0:
            return center_path, [center_node], []

        co_rows = (
            await self._session.execute(
                select(
                    ItemTag.tag_id.label("tag_id"),
                    Tag.path.label("tag_path"),
                    func.count(func.distinct(ItemTag.item_id)).label("co_count"),
                )
                .join(Tag, Tag.id == ItemTag.tag_id)
                .join(center_items, center_items.c.item_id == ItemTag.item_id)
                .where(ItemTag.tag_id != center.id)
                .group_by(ItemTag.tag_id, Tag.path)
            )
        ).all()

        if not co_rows:
            return center_path, [center_node], []

        neighbor_ids = [row.tag_id for row in co_rows]
        neighbor_counts_rows = (
            await self._session.execute(
                select(
                    ItemTag.tag_id.label("tag_id"),
                    func.count(func.distinct(ItemTag.item_id)).label("tag_count"),
                )
                .join(filtered_items, filtered_items.c.item_id == ItemTag.item_id)
                .where(ItemTag.tag_id.in_(neighbor_ids))
                .group_by(ItemTag.tag_id)
            )
        ).all()
        neighbor_counts = {int(row.tag_id): int(row.tag_count) for row in neighbor_counts_rows}

        weighted_neighbors: list[tuple[str, int, int, float]] = []
        for row in co_rows:
            co_count = int(row.co_count or 0)
            tag_count = neighbor_counts.get(int(row.tag_id), 0)
            if co_count <= 0 or tag_count <= 0:
                continue
            weight = co_count / math.sqrt(center_count * tag_count)
            if weight < min_weight:
                continue
            weighted_neighbors.append(
                (
                    str(row.tag_path),
                    tag_count,
                    co_count,
                    round(weight, 4),
                )
            )

        weighted_neighbors.sort(
            key=lambda item: (-item[3], -item[2], item[0].lower(), item[0])
        )
        selected = weighted_neighbors[:max_neighbors]
        if not selected:
            return center_path, [center_node], []

        nodes = [center_node]
        edges: list[TagGraphEdge] = []
        for tag_path, tag_count, co_count, weight in selected:
            nodes.append(
                TagGraphNode(
                    id=tag_path,
                    label=tag_path,
                    count=tag_count,
                    is_center=False,
                )
            )
            edges.append(
                TagGraphEdge(
                    source=center_path,
                    target=tag_path,
                    co_count=co_count,
                    weight=weight,
                )
            )

        return center_path, nodes, edges

    async def get_relation_graph(
        self,
        *,
        mode: GraphMode,
        include_archived: bool = False,
        days: int | None = None,
        max_nodes: int = 300,
        max_edges: int = 1500,
        min_shared: int = 1,
    ) -> tuple[list[RelationGraphNode], list[RelationGraphEdge]]:
        if mode == "item":
            return await self._build_item_relation_graph(
                include_archived=include_archived,
                days=days,
                max_nodes=max_nodes,
                max_edges=max_edges,
                min_shared=min_shared,
            )
        return await self._build_tag_relation_graph(
            include_archived=include_archived,
            days=days,
            max_nodes=max_nodes,
            max_edges=max_edges,
            min_shared=min_shared,
        )

    def _item_filters(
        self,
        *,
        include_archived: bool,
        days: int | None,
    ) -> list:
        filters = [Item.is_deleted.is_(False)]
        if not include_archived:
            filters.append(Item.is_archived.is_(False))
        if days is not None:
            start_at = datetime.now(timezone.utc) - timedelta(days=days)
            filters.append(Item.created_at >= start_at)
        return filters

    async def _build_tag_relation_graph(
        self,
        *,
        include_archived: bool,
        days: int | None,
        max_nodes: int,
        max_edges: int,
        min_shared: int,
    ) -> tuple[list[RelationGraphNode], list[RelationGraphEdge]]:
        filters = self._item_filters(include_archived=include_archived, days=days)
        filtered_items = select(Item.id.label("item_id")).where(*filters).subquery()

        active_rows = (
            await self._session.execute(
                select(
                    Tag.id.label("tag_id"),
                    Tag.path.label("tag_path"),
                    Tag.parent_id.label("parent_id"),
                    func.count(func.distinct(ItemTag.item_id)).label("doc_count"),
                )
                .join(ItemTag, ItemTag.tag_id == Tag.id)
                .join(filtered_items, filtered_items.c.item_id == ItemTag.item_id)
                .group_by(Tag.id, Tag.path, Tag.parent_id)
                .order_by(func.count(func.distinct(ItemTag.item_id)).desc(), Tag.path.asc())
            )
        ).all()
        if not active_rows:
            return [], []

        active_counts = {int(row.tag_id): int(row.doc_count) for row in active_rows}
        active_ids = list(active_counts.keys())
        if len(active_ids) > max_nodes:
            ranked = sorted(
                active_rows,
                key=lambda row: (-int(row.doc_count), str(row.tag_path).lower(), str(row.tag_path)),
            )
            active_ids = [int(row.tag_id) for row in ranked[:max_nodes]]
            active_counts = {tag_id: active_counts[tag_id] for tag_id in active_ids}

        tags_rows = (
            await self._session.execute(
                select(Tag.id, Tag.path, Tag.parent_id).where(Tag.id.in_(active_ids))
            )
        ).all()
        tag_path_by_id = {int(row.id): str(row.path) for row in tags_rows}
        parent_by_id = {int(row.id): int(row.parent_id) if row.parent_id is not None else None for row in tags_rows}

        nodes = [
            RelationGraphNode(
                id=f"tag:{tag_path_by_id[tag_id]}",
                label=tag_path_by_id[tag_id],
                node_type="tag",
                count=active_counts.get(tag_id, 0),
            )
            for tag_id in active_ids
            if tag_id in tag_path_by_id
        ]

        hierarchy_edges: list[RelationGraphEdge] = []
        for tag_id in active_ids:
            parent_id = parent_by_id.get(tag_id)
            if parent_id is None or parent_id not in tag_path_by_id:
                continue
            source_path = tag_path_by_id[parent_id]
            target_path = tag_path_by_id[tag_id]
            hierarchy_edges.append(
                RelationGraphEdge(
                    id=f"hierarchy:{source_path}->{target_path}",
                    source=f"tag:{source_path}",
                    target=f"tag:{target_path}",
                    edge_type="hierarchy",
                    shared_count=1,
                )
            )

        remaining_for_co_doc = max(max_edges - len(hierarchy_edges), 0)
        co_doc_edges: list[RelationGraphEdge] = []
        if remaining_for_co_doc > 0 and active_ids:
            pair_rows = (
                await self._session.execute(
                    select(
                        ItemTag.tag_id.label("source_tag_id"),
                        ItemTagAlias.tag_id.label("target_tag_id"),
                        func.count(func.distinct(ItemTag.item_id)).label("shared_count"),
                    )
                    .join(
                        ItemTagAlias,
                        (ItemTag.item_id == ItemTagAlias.item_id)
                        & (ItemTag.tag_id < ItemTagAlias.tag_id),
                    )
                    .join(filtered_items, filtered_items.c.item_id == ItemTag.item_id)
                    .where(ItemTag.tag_id.in_(active_ids))
                    .where(ItemTagAlias.tag_id.in_(active_ids))
                    .group_by(ItemTag.tag_id, ItemTagAlias.tag_id)
                    .having(func.count(func.distinct(ItemTag.item_id)) >= min_shared)
                    .order_by(
                        func.count(func.distinct(ItemTag.item_id)).desc(),
                        ItemTag.tag_id.asc(),
                        ItemTagAlias.tag_id.asc(),
                    )
                    .limit(remaining_for_co_doc)
                )
            ).all()

            for row in pair_rows:
                source_id = int(row.source_tag_id)
                target_id = int(row.target_tag_id)
                source_path = tag_path_by_id.get(source_id)
                target_path = tag_path_by_id.get(target_id)
                if not source_path or not target_path:
                    continue
                co_doc_edges.append(
                    RelationGraphEdge(
                        id=f"co-doc:{source_path}<->{target_path}",
                        source=f"tag:{source_path}",
                        target=f"tag:{target_path}",
                        edge_type="co_doc",
                        shared_count=int(row.shared_count),
                    )
                )

        edges = hierarchy_edges + co_doc_edges
        return nodes, edges

    async def _build_item_relation_graph(
        self,
        *,
        include_archived: bool,
        days: int | None,
        max_nodes: int,
        max_edges: int,
        min_shared: int,
    ) -> tuple[list[RelationGraphNode], list[RelationGraphEdge]]:
        filters = self._item_filters(include_archived=include_archived, days=days)
        filtered_items = select(Item.id.label("item_id")).where(*filters).subquery()

        item_rows = (
            await self._session.execute(
                select(
                    Item.id.label("item_id"),
                    Item.title.label("title"),
                    Item.url.label("url"),
                    func.count(func.distinct(ItemTag.tag_id)).label("tag_count"),
                )
                .join(filtered_items, filtered_items.c.item_id == Item.id)
                .join(ItemTag, ItemTag.item_id == Item.id)
                .group_by(Item.id, Item.title, Item.url)
                .order_by(
                    func.count(func.distinct(ItemTag.tag_id)).desc(),
                    Item.updated_at.desc(),
                    Item.id.asc(),
                )
                .limit(max_nodes)
            )
        ).all()
        if not item_rows:
            return [], []

        item_ids = [row.item_id for row in item_rows]
        label_by_item_id = {
            row.item_id: (str(row.title).strip() if row.title else str(row.url))
            for row in item_rows
        }
        count_by_item_id = {row.item_id: int(row.tag_count) for row in item_rows}

        nodes = [
            RelationGraphNode(
                id=f"item:{item_id}",
                label=label_by_item_id[item_id],
                node_type="item",
                count=count_by_item_id[item_id],
            )
            for item_id in item_ids
        ]

        pair_rows = (
            await self._session.execute(
                select(
                    ItemTag.item_id.label("source_item_id"),
                    ItemTagAlias.item_id.label("target_item_id"),
                    func.count(func.distinct(ItemTag.tag_id)).label("shared_count"),
                )
                .join(
                    ItemTagAlias,
                    (ItemTag.tag_id == ItemTagAlias.tag_id)
                    & (ItemTag.item_id < ItemTagAlias.item_id),
                )
                .where(ItemTag.item_id.in_(item_ids))
                .where(ItemTagAlias.item_id.in_(item_ids))
                .group_by(ItemTag.item_id, ItemTagAlias.item_id)
                .having(func.count(func.distinct(ItemTag.tag_id)) >= min_shared)
                .order_by(
                    func.count(func.distinct(ItemTag.tag_id)).desc(),
                    ItemTag.item_id.asc(),
                    ItemTagAlias.item_id.asc(),
                )
                .limit(max_edges)
            )
        ).all()

        edges: list[RelationGraphEdge] = []
        for row in pair_rows:
            source_item_id = row.source_item_id
            target_item_id = row.target_item_id
            edges.append(
                RelationGraphEdge(
                    id=f"shared-tag:{source_item_id}<->{target_item_id}",
                    source=f"item:{source_item_id}",
                    target=f"item:{target_item_id}",
                    edge_type="shared_tag",
                    shared_count=int(row.shared_count),
                )
            )

        return nodes, edges


ItemTagAlias = aliased(ItemTag)
