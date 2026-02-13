from __future__ import annotations

import asyncio
import hashlib
import os
from collections import OrderedDict
from collections.abc import Iterable

import httpx

from app.core.ai_settings import AiRuntimeSettings, get_ai_settings

DEFAULT_MODEL = "text-embedding-v4"
DEFAULT_DIMENSIONS = 1024
DEFAULT_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"
MAX_BATCH_SIZE = 10
EMBEDDING_CACHE_SIZE = max(int(os.getenv("EMBEDDING_CACHE_SIZE", "2048")), 0)
_embedding_cache: OrderedDict[str, list[float]] = OrderedDict()


async def embed_texts(
    texts: Iterable[str],
    *,
    settings: AiRuntimeSettings | None = None,
) -> list[list[float]]:
    cleaned = [text.strip() for text in texts if text and text.strip()]
    if not cleaned:
        return []

    settings = settings or await get_ai_settings()
    api_key = settings.embedding_api_key
    if not api_key:
        raise ValueError("ALIYUN_API_KEY is required for embeddings")
    base_url = settings.embedding_base_url or DEFAULT_BASE_URL
    endpoint = f"{base_url.rstrip('/')}/embeddings"
    model = settings.embedding_model or DEFAULT_MODEL
    dimensions = settings.embedding_dimensions or DEFAULT_DIMENSIONS
    soft_timeout = float(os.getenv("EMBEDDING_TIMEOUT_SOFT_S", "10"))
    hard_timeout = float(
        os.getenv("EMBEDDING_TIMEOUT_HARD_S", os.getenv("EMBEDDING_TIMEOUT_S", "20"))
    )
    if hard_timeout < soft_timeout:
        hard_timeout = soft_timeout

    headers = {"Authorization": f"Bearer {api_key}"}
    vectors: list[list[float] | None] = [None] * len(cleaned)
    missing_keys: dict[str, str] = {}
    missing_positions: dict[str, list[int]] = {}

    for index, text in enumerate(cleaned):
        cache_key = _make_cache_key(model, dimensions, text)
        cached = _cache_get(cache_key)
        if cached is not None:
            vectors[index] = cached
            continue
        missing_keys.setdefault(cache_key, text)
        missing_positions.setdefault(cache_key, []).append(index)

    if not missing_keys:
        return [vector or [] for vector in vectors]

    async with httpx.AsyncClient(timeout=hard_timeout) as client:
        ordered_missing_keys = list(missing_keys.keys())
        ordered_missing_texts = [missing_keys[key] for key in ordered_missing_keys]
        fetched_vectors: list[list[float]] = []
        for batch in _batched(ordered_missing_texts, MAX_BATCH_SIZE):
            payload = {
                "model": model,
                "input": batch,
                "dimensions": dimensions,
                "encoding_format": "float",
            }
            response = await asyncio.wait_for(
                client.post(endpoint, json=payload, headers=headers),
                timeout=soft_timeout,
            )
            response.raise_for_status()
            data = response.json()

            items = data.get("data", [])
            items_sorted = sorted(items, key=lambda item: item.get("index", 0))
            batch_vectors = [item.get("embedding", []) for item in items_sorted]

            if len(batch_vectors) != len(batch):
                raise ValueError("Embedding response count mismatch")

            for vector in batch_vectors:
                if len(vector) != dimensions:
                    raise ValueError("Embedding dimension mismatch")
                fetched_vectors.append(vector)

        if len(fetched_vectors) != len(ordered_missing_keys):
            raise ValueError("Embedding response count mismatch")

        for key, vector in zip(ordered_missing_keys, fetched_vectors):
            _cache_put(key, vector)
            for index in missing_positions.get(key, []):
                vectors[index] = vector

    return [vector or [] for vector in vectors]


def _batched(items: list[str], size: int) -> Iterable[list[str]]:
    for index in range(0, len(items), size):
        yield items[index : index + size]


def _make_cache_key(model: str, dimensions: int, text: str) -> str:
    digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
    return f"{model}:{dimensions}:{digest}"


def _cache_get(key: str) -> list[float] | None:
    if EMBEDDING_CACHE_SIZE <= 0:
        return None
    cached = _embedding_cache.get(key)
    if cached is None:
        return None
    _embedding_cache.move_to_end(key)
    return list(cached)


def _cache_put(key: str, vector: list[float]) -> None:
    if EMBEDDING_CACHE_SIZE <= 0:
        return
    _embedding_cache[key] = list(vector)
    _embedding_cache.move_to_end(key)
    while len(_embedding_cache) > EMBEDDING_CACHE_SIZE:
        _embedding_cache.popitem(last=False)
