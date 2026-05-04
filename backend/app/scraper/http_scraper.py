from __future__ import annotations

import trafilatura

from app.scraper.types import ScrapeResult


def fetch_http(url: str) -> ScrapeResult:
    html = trafilatura.fetch_url(url)
    if not html:
        return ScrapeResult(url=url, title=None, content_text=None, html=None, used_fallback=False)

    metadata = trafilatura.extract_metadata(html)
    title = metadata.title if metadata else None
    content = trafilatura.extract(html, include_comments=False, include_tables=False)
    return ScrapeResult(
        url=url,
        title=title,
        content_text=content,
        html=html,
        used_fallback=False,
    )
