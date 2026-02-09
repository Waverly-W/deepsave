from __future__ import annotations

import os
from datetime import datetime, timezone

from app.models.item import Item


def fuse_rrf(
    ranked_lists: list[list[tuple[Item, float]]],
    *,
    k: int | None = None,
) -> list[tuple[Item, float]]:
    k_value = _resolve_k(k)
    scores: dict[object, float] = {}
    items: dict[object, Item] = {}

    for ranked in ranked_lists:
        for rank, (item, _score) in enumerate(ranked, start=1):
            item_id = item.id
            items[item_id] = item
            scores[item_id] = scores.get(item_id, 0.0) + 1.0 / (k_value + rank)

    def sort_key(item: Item) -> tuple[float, float, str]:
        score = scores.get(item.id, 0.0)
        created_at = item.created_at or datetime.min.replace(tzinfo=timezone.utc)
        return (-score, -created_at.timestamp(), str(item.id))

    ordered = sorted(items.values(), key=sort_key)
    return [(item, scores.get(item.id, 0.0)) for item in ordered]


def _resolve_k(override: int | None) -> int:
    if override is not None and override > 0:
        return override

    raw = os.getenv("RRF_K_CONSTANT", "60")
    try:
        value = int(raw)
    except ValueError:
        return 60
    return value if value > 0 else 60
