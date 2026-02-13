from __future__ import annotations

import re
from collections.abc import Mapping

DEFAULT_SUMMARY_SYSTEM_PROMPT = (
    "You are a precise summarizer. Return only JSON. "
    "The summary must contain exactly 3 bullet points, plain text, no markdown headers."
)

DEFAULT_SUMMARY_USER_PROMPT_TEMPLATE = """{context}Content:
{content}

Return a JSON object with keys: summary (string with 3 bullet lines starting with '- ') and tags (array of short tags without spaces).
Return 4-8 tags total.
Tags must use '/' for hierarchy and be at most {max_tag_depth} levels deep.
Include 1-2 hierarchical tags with 2-3 levels when possible.
Use existing tags when they are a good fit, but you may add 1-3 new tags if important concepts are missing.
Ensure tags cover both the main domain and a specific focus; avoid near-duplicates.
{language_instruction}
{existing_tags_instruction}"""

DEFAULT_POLISH_SYSTEM_PROMPT = "You are a precise editor. Return only JSON."

DEFAULT_POLISH_USER_PROMPT_TEMPLATE = """{context}Content:
{content}

Polish and format the title and content.
Preserve meaning and facts. Do not add new information.
Return a JSON object with keys: title (string) and content (markdown string).
Use clear structure with headings and lists when appropriate.
Keep links, code blocks, and proper nouns intact.
{language_instruction}"""

DEFAULT_VISION_USER_PROMPT = "Describe the image in detail."

_TEMPLATE_VAR_PATTERN = re.compile(r"{([a-zA-Z_][a-zA-Z0-9_]*)}")


def render_prompt_template(template: str, values: Mapping[str, str]) -> str:
    def replace(match: re.Match[str]) -> str:
        key = match.group(1)
        return values.get(key, match.group(0))

    return _TEMPLATE_VAR_PATTERN.sub(replace, template)
