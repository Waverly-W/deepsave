from __future__ import annotations

import asyncio
import os
from collections.abc import Iterable

import httpx

from app.core.ai_settings import AiRuntimeSettings, get_ai_settings

DEFAULT_MODEL = "text-embedding-v4"
DEFAULT_DIMENSIONS = 1024
DEFAULT_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"
MAX_BATCH_SIZE = 10


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
    vectors: list[list[float]] = []

    async with httpx.AsyncClient(timeout=hard_timeout) as client:
        for batch in _batched(cleaned, MAX_BATCH_SIZE):
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
                vectors.append(vector)

    return vectors


def _batched(items: list[str], size: int) -> Iterable[list[str]]:
    for index in range(0, len(items), size):
        yield items[index : index + size]
