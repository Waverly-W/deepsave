import re

from bs4 import BeautifulSoup

_SPACE_RE = re.compile(r"[ \t]+")


def html_to_text(html: str | None) -> str | None:
    if not html or not html.strip():
        return None

    soup = BeautifulSoup(html, "html.parser")
    text = soup.get_text(separator="\n")
    cleaned = _normalize_text(text)
    return cleaned if cleaned else None


def _normalize_text(text: str) -> str:
    lines = []
    for line in text.splitlines():
        cleaned = _SPACE_RE.sub(" ", line).strip()
        if cleaned:
            lines.append(cleaned)
    return "\n".join(lines).strip()
