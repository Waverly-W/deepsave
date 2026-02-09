from __future__ import annotations

from bs4 import BeautifulSoup
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


def needs_playwright(html: str | None, content_text: str | None) -> bool:
    if not html or not content_text:
        return True
    if len(content_text) < 1000:
        return True
    soup = BeautifulSoup(html, "html.parser")
    if soup.find("div", id="app") is not None:
        return True
    return False
