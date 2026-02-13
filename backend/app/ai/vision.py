from __future__ import annotations

import base64
import imghdr
import os
from io import BytesIO

import colorgram
import httpx

from app.ai.prompt_templates import DEFAULT_VISION_USER_PROMPT
from app.core.ai_settings import AiRuntimeSettings, get_ai_settings
DEFAULT_DESCRIPTION = "No description generated."
DEFAULT_PALETTE_COUNT = 5


def extract_palette(image_bytes: bytes, count: int = DEFAULT_PALETTE_COUNT) -> list[str]:
    colors = colorgram.extract(BytesIO(image_bytes), count)
    palette: list[str] = []
    for color in colors:
        rgb = color.rgb
        palette.append(f"#{rgb.r:02x}{rgb.g:02x}{rgb.b:02x}")
    return palette


async def describe_image(
    image_bytes: bytes,
    *,
    settings: AiRuntimeSettings | None = None,
) -> str:
    settings = settings or await get_ai_settings()
    api_key = settings.vision_api_key
    if not api_key:
        return DEFAULT_DESCRIPTION

    data_url = _to_data_url(image_bytes)
    if not data_url:
        return DEFAULT_DESCRIPTION
    user_prompt = settings.vision_user_prompt or DEFAULT_VISION_USER_PROMPT

    payload = {
        "model": settings.vision_model or "gpt-4o-mini",
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": user_prompt},
                    {"type": "image_url", "image_url": {"url": data_url}},
                ],
            }
        ],
        "temperature": 0.2,
    }
    headers = {"Authorization": f"Bearer {api_key}"}
    timeout = float(os.getenv("VISION_TIMEOUT_S", os.getenv("LLM_TIMEOUT_S", "60")))
    endpoint = _chat_endpoint(settings.vision_base_url)

    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(endpoint, json=payload, headers=headers)
        try:
            response.raise_for_status()
        except httpx.HTTPError:
            return DEFAULT_DESCRIPTION
        data = response.json()

    choices = data.get("choices")
    if not choices:
        return DEFAULT_DESCRIPTION
    message = choices[0].get("message") or {}
    content = message.get("content")
    if not isinstance(content, str):
        return DEFAULT_DESCRIPTION
    return content.strip() or DEFAULT_DESCRIPTION


def _to_data_url(image_bytes: bytes) -> str | None:
    kind = imghdr.what(None, image_bytes)
    if kind in {"jpeg", "jpg"}:
        mime = "image/jpeg"
    elif kind == "png":
        mime = "image/png"
    elif kind == "gif":
        mime = "image/gif"
    elif kind == "webp":
        mime = "image/webp"
    else:
        mime = "image/png"

    encoded = base64.b64encode(image_bytes).decode("ascii")
    return f"data:{mime};base64,{encoded}"


def _chat_endpoint(base_url: str | None) -> str:
    base = (base_url or "https://api.openai.com/v1").rstrip("/")
    if not base.endswith("/v1"):
        base = f"{base}/v1"
    return f"{base}/chat/completions"
