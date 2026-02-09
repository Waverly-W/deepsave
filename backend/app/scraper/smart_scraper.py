from __future__ import annotations

from app.scraper.http_scraper import fetch_http, needs_playwright
from app.scraper.playwright_scraper import fetch_playwright
from app.scraper.types import ScrapeResult


async def scrape_url(url: str, *, item_id: str) -> ScrapeResult:
    http_result = fetch_http(url)
    if needs_playwright(http_result.html, http_result.content_text):
        return await fetch_playwright(url, item_id=item_id)
    return http_result
