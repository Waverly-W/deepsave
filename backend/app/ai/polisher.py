from __future__ import annotations

import asyncio
import json
import os
from dataclasses import dataclass
from typing import Any, AsyncIterator

import httpx

from app.ai.prompt_templates import (
    DEFAULT_POLISH_SYSTEM_PROMPT,
    DEFAULT_POLISH_USER_PROMPT_TEMPLATE,
    render_prompt_template,
)
from app.core.ai_settings import AiRuntimeSettings, get_ai_settings

MAX_INPUT_CHARS = int(os.getenv("LLM_MAX_INPUT_CHARS", "12000"))
MAX_PARSE_ATTEMPTS = 3


@dataclass
class PolishResult:
    title: str
    content_markdown: str
    raw_output: str | None = None
    parsed: bool = True
    fallback_reason: str | None = None


async def polish_text(
    content: str | None,
    *,
    title: str | None = None,
    url: str | None = None,
    settings: AiRuntimeSettings | None = None,
    language: str | None = None,
) -> PolishResult:
    cleaned = (content or "").strip()
    base_title = (title or "").strip()
    if not cleaned:
        return PolishResult(
            title=base_title,
            content_markdown=cleaned,
            parsed=False,
            fallback_reason="empty_content",
        )

    settings = settings or await get_ai_settings()
    api_key = settings.llm_api_key
    if not api_key:
        return PolishResult(
            title=base_title,
            content_markdown=cleaned,
            parsed=False,
            fallback_reason="missing_api_key",
        )

    base_url = settings.llm_base_url
    model = settings.llm_model
    messages = _build_messages(
        cleaned[:MAX_INPUT_CHARS],
        title=title,
        url=url,
        settings=settings,
        language=language,
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
            return PolishResult(
                title=base_title,
                content_markdown=cleaned,
                parsed=False,
                fallback_reason=reason,
            )

        parsed = _parse_json(last_output)
        if parsed is None:
            continue

        next_title, content_markdown = _extract_title_content(parsed)
        return PolishResult(
            title=(next_title or base_title).strip(),
            content_markdown=(content_markdown or "").strip(),
            raw_output=last_output,
        )

    return PolishResult(
        title=base_title,
        content_markdown=cleaned,
        raw_output=last_output,
        parsed=False,
        fallback_reason="parse_error",
    )


def build_polish_messages(
    content: str,
    *,
    title: str | None,
    url: str | None,
    settings: AiRuntimeSettings | None = None,
    language: str | None = None,
) -> list[dict[str, str]]:
    trimmed = (content or "").strip()[:MAX_INPUT_CHARS]
    return _build_messages(
        trimmed,
        title=title,
        url=url,
        settings=settings,
        language=language,
    )


def parse_polish_output(
    raw_output: str | None,
    *,
    fallback_title: str,
    fallback_content: str,
) -> PolishResult:
    if not raw_output:
        return PolishResult(
            title=fallback_title,
            content_markdown=fallback_content,
            parsed=False,
            fallback_reason="empty_output",
        )
    parsed = _parse_json(raw_output)
    if parsed is None:
        return PolishResult(
            title=fallback_title,
            content_markdown=fallback_content,
            raw_output=raw_output,
            parsed=False,
            fallback_reason="parse_error",
        )
    title, content = _extract_title_content(parsed)
    return PolishResult(
        title=(title or fallback_title).strip(),
        content_markdown=(content or fallback_content).strip(),
        raw_output=raw_output,
    )


class JsonFieldStreamExtractor:
    def __init__(self, field: str) -> None:
        self._key = f"\"{field}\""
        self._key_index = 0
        self._state = "search_key"
        self._escape = False
        self._unicode_remaining = 0
        self._unicode_buffer = ""

    def feed(self, text: str) -> str:
        if not text:
            return ""
        output: list[str] = []
        for char in text:
            if self._state == "search_key":
                if char == self._key[self._key_index]:
                    self._key_index += 1
                    if self._key_index == len(self._key):
                        self._state = "search_colon"
                        self._key_index = 0
                else:
                    self._key_index = 1 if char == self._key[0] else 0
            elif self._state == "search_colon":
                if char == ":":
                    self._state = "search_quote"
            elif self._state == "search_quote":
                if char == "\"":
                    self._state = "in_string"
            elif self._state == "in_string":
                if self._unicode_remaining > 0:
                    if char.lower() in "0123456789abcdef":
                        self._unicode_buffer += char
                        self._unicode_remaining -= 1
                        if self._unicode_remaining == 0:
                            try:
                                output.append(chr(int(self._unicode_buffer, 16)))
                            except ValueError:
                                output.append(f"\\u{self._unicode_buffer}")
                            self._unicode_buffer = ""
                    else:
                        output.append("\\u" + self._unicode_buffer + char)
                        self._unicode_remaining = 0
                        self._unicode_buffer = ""
                elif self._escape:
                    if char == "n":
                        output.append("\n")
                    elif char == "t":
                        output.append("\t")
                    elif char == "r":
                        output.append("\r")
                    elif char == "b":
                        output.append("\b")
                    elif char == "f":
                        output.append("\f")
                    elif char == "u":
                        self._unicode_remaining = 4
                        self._unicode_buffer = ""
                    else:
                        output.append(char)
                    self._escape = False
                else:
                    if char == "\\":
                        self._escape = True
                    elif char == "\"":
                        self._state = "done"
                    else:
                        output.append(char)
        return "".join(output)


async def stream_chat_completion(
    api_key: str,
    messages: list[dict[str, str]],
    *,
    base_url: str | None,
    model: str | None,
) -> AsyncIterator[str]:
    payload = {
        "model": model or "gpt-4o-mini",
        "messages": messages,
        "temperature": 0.2,
        "stream": True,
    }
    headers = {"Authorization": f"Bearer {api_key}"}
    soft_timeout = float(os.getenv("LLM_TIMEOUT_SOFT_S", os.getenv("LLM_TIMEOUT_S", "60")))
    hard_timeout = float(os.getenv("LLM_TIMEOUT_HARD_S", os.getenv("LLM_TIMEOUT_S", "90")))
    if hard_timeout < soft_timeout:
        hard_timeout = soft_timeout
    async with httpx.AsyncClient(timeout=hard_timeout) as client:
        async with client.stream(
            "POST",
            _chat_endpoint(base_url),
            json=payload,
            headers=headers,
        ) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if not line:
                    continue
                if not line.startswith("data:"):
                    continue
                data = line[len("data:") :].strip()
                if data == "[DONE]":
                    break
                try:
                    payload = json.loads(data)
                except json.JSONDecodeError:
                    continue
                delta = (
                    payload.get("choices", [{}])[0]
                    .get("delta", {})
                    .get("content")
                )
                if isinstance(delta, str) and delta:
                    yield delta

def _extract_title_content(payload: dict[str, Any]) -> tuple[str | None, str | None]:
    title_value = payload.get("title")
    content_value = payload.get("content") or payload.get("content_markdown")

    title: str | None
    if isinstance(title_value, str):
        title = title_value.strip()
    else:
        title = None

    content: str | None
    if isinstance(content_value, list):
        content = "\n".join(str(line) for line in content_value if str(line).strip())
    elif isinstance(content_value, str):
        content = content_value.strip()
    else:
        content = None

    return title, content


def _build_messages(
    content: str,
    *,
    title: str | None,
    url: str | None,
    settings: AiRuntimeSettings | None = None,
    language: str | None = None,
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
        language_instruction = "Content language: Chinese. Output in Chinese."
    elif language == "en":
        language_instruction = "Content language: English. Output in English."

    system_prompt = settings.polish_system_prompt if settings else DEFAULT_POLISH_SYSTEM_PROMPT
    user_template = (
        settings.polish_user_prompt_template
        if settings
        else DEFAULT_POLISH_USER_PROMPT_TEMPLATE
    )
    user_prompt = render_prompt_template(
        user_template,
        {
            "context": context,
            "content": content,
            "title": title or "",
            "url": url or "",
            "language_instruction": language_instruction,
        },
    ).strip()
    if not user_prompt:
        user_prompt = render_prompt_template(
            DEFAULT_POLISH_USER_PROMPT_TEMPLATE,
            {
                "context": context,
                "content": content,
                "title": title or "",
                "url": url or "",
                "language_instruction": language_instruction,
            },
        ).strip()

    normalized_system_prompt = (
        system_prompt.strip()
        if isinstance(system_prompt, str) and system_prompt.strip()
        else DEFAULT_POLISH_SYSTEM_PROMPT
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
