from __future__ import annotations

from app.scraper.http_scraper import fetch_http
from app.scraper.types import ScrapeResult


async def scrape_url(url: str, *, item_id: str) -> ScrapeResult:
    return fetch_http(url)
