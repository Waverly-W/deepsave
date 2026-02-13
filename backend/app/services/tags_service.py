from __future__ import annotations

from collections import defaultdict

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.item import Item
from app.models.item_tag import ItemTag
from app.models.tag import Tag
from app.schemas.tags import TagTreeItem, TagTreeNode


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
