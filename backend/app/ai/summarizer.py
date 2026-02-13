from __future__ import annotations

import asyncio
import json
import os
from dataclasses import dataclass
from typing import Any, Iterable

import httpx

from app.ai.prompt_templates import (
    DEFAULT_SUMMARY_SYSTEM_PROMPT,
    DEFAULT_SUMMARY_USER_PROMPT_TEMPLATE,
    render_prompt_template,
)
from app.core.ai_settings import AiRuntimeSettings, get_ai_settings

DEFAULT_SUMMARY = "No summary generated."
DEFAULT_TAGS: list[str] = []
MAX_PARSE_ATTEMPTS = 3
MAX_INPUT_CHARS = int(os.getenv("LLM_MAX_INPUT_CHARS", "12000"))
TAG_LANGUAGE_THRESHOLD = float(os.getenv("TAG_LANGUAGE_THRESHOLD", "0.6"))
DEFAULT_MAX_TAG_DEPTH = int(os.getenv("TAG_MAX_DEPTH", "3"))


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
    existing_tags: list[str] | None = None,
    language: str | None = None,
    max_tag_depth: int = DEFAULT_MAX_TAG_DEPTH,
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
    messages = _build_messages(
        cleaned[:MAX_INPUT_CHARS],
        title=title,
        url=url,
        settings=settings,
        existing_tags=existing_tags,
        language=language,
        max_tag_depth=max_tag_depth,
    )
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
        normalized_tags = normalize_tags(tags, max_depth=max_tag_depth)
        normalized_tags = filter_tags_by_language(normalized_tags, language)
        return AnalysisResult(
            summary=summary,
            tags=normalized_tags,
            raw_output=last_output,
        )

    fallback_summary = (last_output or "").strip() or DEFAULT_SUMMARY
    return AnalysisResult(
        summary=fallback_summary,
        tags=normalize_tags(["#parse_error"], max_depth=max_tag_depth),
        raw_output=last_output,
        parsed=False,
        fallback_reason="parse_error",
    )


def detect_language(content: str | None, title: str | None = None) -> str:
    combined = "\n".join([part for part in [(title or "").strip(), (content or "").strip()] if part])
    if not combined:
        return "unknown"

    cjk_count, latin_count = _count_cjk_latin(combined)
    total = cjk_count + latin_count
    if total == 0:
        return "unknown"

    cjk_ratio = cjk_count / total
    latin_ratio = latin_count / total
    if cjk_ratio >= TAG_LANGUAGE_THRESHOLD:
        return "zh"
    if latin_ratio >= TAG_LANGUAGE_THRESHOLD:
        return "en"
    return "zh" if cjk_count >= latin_count else "en"


def normalize_tag_path(tag: str, *, max_depth: int = DEFAULT_MAX_TAG_DEPTH) -> str | None:
    cleaned = tag.strip()
    if not cleaned:
        return None
    if cleaned == "#parse_error":
        return cleaned
    cleaned = cleaned.replace(" ", "").replace("\\", "/")
    if cleaned.startswith("#"):
        cleaned = cleaned[1:]
    parts = [part for part in cleaned.split("/") if part]
    if not parts:
        return None
    parts = parts[:max_depth]
    normalized_parts: list[str] = []
    for part in parts:
        segment = part.strip()
        if not segment:
            continue
        if segment != "#parse_error" and segment.startswith("#"):
            segment = segment[1:]
        normalized_parts.append(segment.lower())
    if not normalized_parts:
        return None
    return "/".join(normalized_parts)


def normalize_tags(tags: Iterable[str], *, max_depth: int = DEFAULT_MAX_TAG_DEPTH) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()
    for tag in tags:
        cleaned = normalize_tag_path(tag, max_depth=max_depth)
        if not cleaned or cleaned in seen:
            continue
        normalized.append(cleaned)
        seen.add(cleaned)
    return normalized


def filter_tags_by_language(tags: list[str], language: str | None) -> list[str]:
    if language not in {"zh", "en"}:
        return tags
    filtered: list[str] = []
    for tag in tags:
        tag_lang = _tag_language(tag)
        if tag_lang == "unknown" or tag_lang == language:
            filtered.append(tag)
    return filtered


def _tag_language(tag: str) -> str:
    leaf = tag.split("/")[-1] if tag else ""
    cjk_count, latin_count = _count_cjk_latin(leaf)
    total = cjk_count + latin_count
    if total == 0:
        return "unknown"
    cjk_ratio = cjk_count / total
    latin_ratio = latin_count / total
    if cjk_ratio >= TAG_LANGUAGE_THRESHOLD:
        return "zh"
    if latin_ratio >= TAG_LANGUAGE_THRESHOLD:
        return "en"
    return "zh" if cjk_count >= latin_count else "en"


def _count_cjk_latin(text: str) -> tuple[int, int]:
    cjk_count = 0
    latin_count = 0
    for char in text:
        codepoint = ord(char)
        if _is_cjk(codepoint):
            cjk_count += 1
        elif ("a" <= char <= "z") or ("A" <= char <= "Z"):
            latin_count += 1
    return cjk_count, latin_count


def _is_cjk(codepoint: int) -> bool:
    return (
        0x4E00 <= codepoint <= 0x9FFF
        or 0x3400 <= codepoint <= 0x4DBF
        or 0x20000 <= codepoint <= 0x2A6DF
        or 0x2A700 <= codepoint <= 0x2B73F
        or 0x2B740 <= codepoint <= 0x2B81F
        or 0x2B820 <= codepoint <= 0x2CEAF
        or 0xF900 <= codepoint <= 0xFAFF
        or 0x2F800 <= codepoint <= 0x2FA1F
    )


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


def _build_messages(
    content: str,
    *,
    title: str | None,
    url: str | None,
    settings: AiRuntimeSettings | None = None,
    existing_tags: list[str] | None = None,
    language: str | None = None,
    max_tag_depth: int = DEFAULT_MAX_TAG_DEPTH,
) -> list[dict[str, str]]:
    context_lines = []
    if title:
        context_lines.append(f"Title: {title}")
    if url:
        context_lines.append(f"URL: {url}")
    context = "\n".join(context_lines)
    if context:
        context += "\n\n"

    language_instruction = ""
    if language == "zh":
        language_instruction = (
            "Content language: Chinese. Tags must be in Chinese and should not include spaces."
        )
    elif language == "en":
        language_instruction = "Content language: English. Tags must be in English and lowercase."

    existing_tags_instruction = ""
    if existing_tags is not None:
        candidates = normalize_tags(existing_tags, max_depth=max_tag_depth)
        if candidates:
            existing_tags_instruction = f"Existing tags: {', '.join(candidates)}"

    system_prompt = (
        settings.summary_system_prompt if settings else DEFAULT_SUMMARY_SYSTEM_PROMPT
    )
    user_template = (
        settings.summary_user_prompt_template
        if settings
        else DEFAULT_SUMMARY_USER_PROMPT_TEMPLATE
    )
    user_prompt = render_prompt_template(
        user_template,
        {
            "context": context,
            "content": content,
            "title": title or "",
            "url": url or "",
            "language_instruction": language_instruction,
            "existing_tags_instruction": existing_tags_instruction,
            "max_tag_depth": str(max_tag_depth),
        },
    ).strip()
    if not user_prompt:
        user_prompt = render_prompt_template(
            DEFAULT_SUMMARY_USER_PROMPT_TEMPLATE,
            {
                "context": context,
                "content": content,
                "title": title or "",
                "url": url or "",
                "language_instruction": language_instruction,
                "existing_tags_instruction": existing_tags_instruction,
                "max_tag_depth": str(max_tag_depth),
            },
        ).strip()

    normalized_system_prompt = (
        system_prompt.strip() if isinstance(system_prompt, str) and system_prompt.strip() else DEFAULT_SUMMARY_SYSTEM_PROMPT
    )

    return [
        {"role": "system", "content": normalized_system_prompt},
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
