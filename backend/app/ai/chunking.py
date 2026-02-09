from __future__ import annotations


def chunk_text(text: str, *, chunk_size: int = 1000, overlap: int = 200) -> list[str]:
    cleaned = text.strip()
    if not cleaned:
        return []

    if overlap >= chunk_size:
        overlap = max(chunk_size - 1, 0)

    step = max(chunk_size - overlap, 1)
    chunks: list[str] = []
    start = 0
    length = len(cleaned)
    while start < length:
        end = min(length, start + chunk_size)
        chunk = cleaned[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= length:
            break
        start += step

    return chunks
