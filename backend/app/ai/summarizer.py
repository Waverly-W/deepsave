from __future__ import annotations

import asyncio
import json
import os
from dataclasses import dataclass
from typing import Any, Iterable

import httpx

from app.core.ai_settings import AiRuntimeSettings, get_ai_settings
DEFAULT_SUMMARY = "No summary generated."
DEFAULT_TAGS: list[str] = []
MAX_PARSE_ATTEMPTS = 3
MAX_INPUT_CHARS = int(os.getenv("LLM_MAX_INPUT_CHARS", "12000"))


@dataclass
class AnalysisResult:
    summary: str
    tags: list[str]
    raw_output: str | None = None
    parsed: bool = True
    fallback_reason: str | None = None

    def to_payload(self) -> dict:
        return {
            "analysis": {
                "summary": self.summary,
                "tags": self.tags,
            }
        }


async def summarize_text(
    content: str | None,
    *,
    title: str | None = None,
    url: str | None = None,
    settings: AiRuntimeSettings | None = None,
) -> AnalysisResult:
    cleaned = (content or "").strip()
    if not cleaned:
        return AnalysisResult(
            summary=DEFAULT_SUMMARY,
            tags=DEFAULT_TAGS.copy(),
            fallback_reason="empty_content",
        )

    settings = settings or await get_ai_settings()
    api_key = settings.llm_api_key
    if not api_key:
        return AnalysisResult(
            summary=DEFAULT_SUMMARY,
            tags=DEFAULT_TAGS.copy(),
            fallback_reason="missing_api_key",
        )

    base_url = settings.llm_base_url
    model = settings.llm_model
    messages = _build_messages(cleaned[:MAX_INPUT_CHARS], title=title, url=url)
    last_output: str | None = None

    for _ in range(MAX_PARSE_ATTEMPTS):
        try:
            last_output = await _call_chat_with_retry(
                api_key,
                messages,
                base_url=base_url,
                model=model,
            )
        except (httpx.HTTPError, asyncio.TimeoutError) as exc:
            reason = "timeout" if isinstance(exc, asyncio.TimeoutError) else "http_error"
            return AnalysisResult(
                summary=DEFAULT_SUMMARY,
                tags=DEFAULT_TAGS.copy(),
                parsed=False,
                fallback_reason=reason,
            )

        parsed = _parse_json(last_output)
        if parsed is None:
            continue

        summary, tags = _extract_summary_tags(parsed)
        summary = _ensure_summary(summary)
        normalized_tags = normalize_tags(tags)
        return AnalysisResult(
            summary=summary,
            tags=normalized_tags,
            raw_output=last_output,
        )

    fallback_summary = (last_output or "").strip() or DEFAULT_SUMMARY
    return AnalysisResult(
        summary=fallback_summary,
        tags=normalize_tags(["#parse_error"]),
        raw_output=last_output,
        parsed=False,
        fallback_reason="parse_error",
    )


def normalize_tags(tags: Iterable[str]) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()
    for tag in tags:
        cleaned = tag.strip().lower().replace(" ", "")
        if not cleaned or cleaned in seen:
            continue
        normalized.append(cleaned)
        seen.add(cleaned)
    return normalized


def _extract_summary_tags(payload: dict[str, Any]) -> tuple[str | None, list[str]]:
    analysis = payload.get("analysis") if isinstance(payload.get("analysis"), dict) else None
    summary_value = (analysis or payload).get("summary")
    tags_value = (analysis or payload).get("tags")

    summary: str | None
    if isinstance(summary_value, list):
        summary = "\n".join(f"- {line}" for line in summary_value if str(line).strip())
    elif isinstance(summary_value, str):
        summary = summary_value.strip()
    else:
        summary = None

    tags: list[str] = []
    if isinstance(tags_value, list):
        tags = [str(tag) for tag in tags_value if str(tag).strip()]
    elif isinstance(tags_value, str):
        pieces = [chunk.strip() for chunk in tags_value.replace("\n", ",").split(",")]
        tags = [piece for piece in pieces if piece]

    return summary, tags


def _ensure_summary(summary: str | None) -> str:
    if summary:
        return summary
    return DEFAULT_SUMMARY


def _build_messages(content: str, *, title: str | None, url: str | None) -> list[dict[str, str]]:
    context_lines = []
    if title:
        context_lines.append(f"Title: {title}")
    if url:
        context_lines.append(f"URL: {url}")
    context = "\n".join(context_lines)
    if context:
        context += "\n\n"

    system_prompt = (
        "You are a precise summarizer. Return only JSON. "
        "The summary must contain exactly 3 bullet points, plain text, no markdown headers."
    )
    user_prompt = (
        f"{context}Content:\n{content}\n\n"
        "Return a JSON object with keys: summary (string with 3 bullet lines starting with '- ') "
        "and tags (array of short lowercase tags without spaces)."
    )

    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]


def _parse_json(raw: str) -> dict[str, Any] | None:
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        cleaned = "\n".join(lines).strip()

    for candidate in (cleaned, _extract_braced(cleaned)):
        if not candidate:
            continue
        try:
            parsed = json.loads(candidate)
        except json.JSONDecodeError:
            continue
        if isinstance(parsed, dict):
            return parsed
    return None


def _extract_braced(text: str) -> str | None:
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return None
    return text[start : end + 1]


def _chat_endpoint(base_url: str | None) -> str:
    base = (base_url or "https://api.openai.com/v1").rstrip("/")
    if not base.endswith("/v1"):
        base = f"{base}/v1"
    return f"{base}/chat/completions"


async def _call_chat(
    api_key: str,
    messages: list[dict[str, str]],
    *,
    base_url: str | None,
    model: str | None,
) -> str:
    payload = {
        "model": model or "gpt-4o-mini",
        "messages": messages,
        "temperature": 0.2,
    }
    headers = {"Authorization": f"Bearer {api_key}"}
    soft_timeout = float(os.getenv("LLM_TIMEOUT_SOFT_S", os.getenv("LLM_TIMEOUT_S", "60")))
    hard_timeout = float(os.getenv("LLM_TIMEOUT_HARD_S", os.getenv("LLM_TIMEOUT_S", "90")))
    if hard_timeout < soft_timeout:
        hard_timeout = soft_timeout
    async with httpx.AsyncClient(timeout=hard_timeout) as client:
        response = await asyncio.wait_for(
            client.post(_chat_endpoint(base_url), json=payload, headers=headers),
            timeout=soft_timeout,
        )
        response.raise_for_status()
        data = response.json()

    choices = data.get("choices")
    if not choices:
        raise httpx.HTTPError("LLM response missing choices")
    message = choices[0].get("message") or {}
    content = message.get("content")
    if not isinstance(content, str):
        raise httpx.HTTPError("LLM response missing content")
    return content


async def _call_chat_with_retry(
    api_key: str,
    messages: list[dict[str, str]],
    *,
    base_url: str | None,
    model: str | None,
) -> str:
    attempts = max(int(os.getenv("LLM_RETRY_ATTEMPTS", "3")), 1)
    base_delay = float(os.getenv("LLM_RETRY_BASE_S", "1"))
    last_exc: Exception | None = None
    for attempt in range(attempts):
        try:
            return await _call_chat(api_key, messages, base_url=base_url, model=model)
        except (httpx.HTTPError, asyncio.TimeoutError) as exc:
            last_exc = exc
            if attempt >= attempts - 1:
                raise
            await asyncio.sleep(base_delay * (2**attempt))
    if last_exc:
        raise last_exc
    raise httpx.HTTPError("LLM call failed")
