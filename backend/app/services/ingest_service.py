import hashlib
import json
import os
from dataclasses import dataclass
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from app.ai.router import route_url
from app.core.redis import get_redis
from app.repositories.item_repo import ItemRepository
from app.utils.markdown import markdown_to_html
from app.utils.url_safety import validate_ingest_url
from app.worker.tasks import process_item

LOCK_TTL_SECONDS = int(os.getenv("INGEST_LOCK_TTL_S", "600"))


class IngestConflictError(ValueError):
    """Raised when the same URL is already being processed."""


@dataclass
class IngestResult:
    task_id: str
    item_id: str
    reused: bool


class IngestService:
    def __init__(self, session) -> None:
        self._items = ItemRepository(session)
        self._redis = get_redis()

    async def ingest(
        self,
        url: str,
        source_type: str | None = None,
        content_text: str | None = None,
        title: str | None = None,
    ) -> IngestResult:
        validate_ingest_url(url)
        normalized_url = normalize_url(url)
        lock_key = _lock_key(normalized_url)
        note_text = content_text.strip() if content_text else None
        note_html = markdown_to_html(note_text) if note_text else None
        resolved_override = source_type or ("note" if note_text else None)
        try:
            existing = await self._redis.get(lock_key)
            if existing:
                try:
                    payload = json.loads(existing)
                    return IngestResult(
                        task_id=payload["task_id"],
                        item_id=payload["item_id"],
                        reused=True,
                    )
                except (json.JSONDecodeError, KeyError):
                    raise IngestConflictError("URL is already processing")

            acquired = await self._redis.set(
                lock_key, "pending", nx=True, ex=LOCK_TTL_SECONDS
            )
            if not acquired:
                raise IngestConflictError("URL is already processing")

            resolved_source_type = route_url(normalized_url, override=resolved_override)
            note_title = title.strip() if title and title.strip() else None
            if resolved_source_type == "note":
                if not note_text:
                    raise ValueError("Note content is empty")
                if not note_title:
                    note_title = note_text.splitlines()[0].strip() or url

            item = await self._items.upsert(
                url=url,
                normalized_url=normalized_url,
                source_type=resolved_source_type,
                title=note_title if resolved_source_type == "note" else None,
                content_text=note_html if resolved_source_type == "note" else None,
                content_format="html" if resolved_source_type == "note" else None,
            )

            task = process_item.delay(str(item.id), lock_key)
            payload = json.dumps({"task_id": task.id, "item_id": str(item.id)})
            await self._redis.set(lock_key, payload, ex=LOCK_TTL_SECONDS)
            return IngestResult(task_id=task.id, item_id=str(item.id), reused=False)
        finally:
            await self._redis.close()


TRACKING_PARAM_PREFIXES = ("utm_",)
TRACKING_PARAM_NAMES = {"fbclid", "gclid", "ref", "source"}


def normalize_url(url: str) -> str:
    parsed = urlparse(url)
    if not parsed.scheme and not parsed.netloc:
        parsed = urlparse(f"http://{url}")

    scheme = parsed.scheme.lower() if parsed.scheme else "http"
    netloc = parsed.netloc.lower()
    path = parsed.path or ""
    if path != "/" and path.endswith("/"):
        path = path[:-1]

    query_params = []
    for key, value in parse_qsl(parsed.query, keep_blank_values=True):
        key_lower = key.lower()
        if key_lower.startswith(TRACKING_PARAM_PREFIXES) or key_lower in TRACKING_PARAM_NAMES:
            continue
        query_params.append((key, value))

    query_params.sort(key=lambda pair: pair[0])
    query = urlencode(query_params, doseq=True)

    normalized = urlunparse((scheme, netloc, path, "", query, ""))
    return normalized


def _lock_key(normalized_url: str) -> str:
    digest = hashlib.md5(normalized_url.encode("utf-8")).hexdigest()
    return f"processing:{digest}"
