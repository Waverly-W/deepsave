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
    type_weights = _resolve_type_weights()
    scores: dict[object, float] = {}
    items: dict[object, Item] = {}

    for ranked in ranked_lists:
        for rank, (item, _score) in enumerate(ranked, start=1):
            item_id = item.id
            items[item_id] = item
            weight = type_weights.get(item.source_type, 1.0)
            scores[item_id] = scores.get(item_id, 0.0) + (weight / (k_value + rank))

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


def _resolve_type_weights() -> dict[str, float]:
    raw = os.getenv("RRF_TYPE_WEIGHTS", "")
    weights: dict[str, float] = {}
    for pair in raw.split(","):
        if ":" not in pair:
            continue
        source_type, value = pair.split(":", 1)
        source = source_type.strip()
        if not source:
            continue
        try:
            weight = float(value.strip())
        except ValueError:
            continue
        if weight <= 0:
            continue
        weights[source] = weight
    return weights
