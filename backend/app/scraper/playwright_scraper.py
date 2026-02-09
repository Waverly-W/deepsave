from __future__ import annotations

import asyncio
import os
from pathlib import Path

from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeout

from app.scraper.artifacts import ensure_artifact_dir, write_bytes, write_text
from app.scraper.types import ScrapeResult


async def fetch_playwright(
    url: str,
    *,
    item_id: str,
    timeout_s: int | None = None,
    retries: int = 1,
    save_screenshot: bool = True,
) -> ScrapeResult:
    soft_timeout = int(os.getenv("PLAYWRIGHT_TIMEOUT_SOFT_S", "30"))
    hard_timeout = int(os.getenv("PLAYWRIGHT_TIMEOUT_HARD_S", "45"))
    if hard_timeout < soft_timeout:
        hard_timeout = soft_timeout
    if timeout_s is None:
        timeout_s = soft_timeout

    attempt = 0
    last_error: Exception | None = None
    while attempt <= retries:
        attempt += 1
        try:
            async def run_once() -> ScrapeResult:
                async with async_playwright() as p:
                    browser = await p.chromium.launch()
                    context = await browser.new_context()
                    page = await context.new_page()
                    await page.goto(
                        url,
                        wait_until="domcontentloaded",
                        timeout=timeout_s * 1000,
                    )
                    html = await page.content()
                    title = await page.title()

                    artifact_dir = ensure_artifact_dir(item_id)
                    html_path = artifact_dir / "content.html"
                    write_text(html_path, html)

                    screenshot_path: Path | None = None
                    if save_screenshot:
                        screenshot_path = artifact_dir / "screenshot.png"
                        data = await page.screenshot(full_page=True)
                        write_bytes(screenshot_path, data)

                    await context.close()
                    await browser.close()

                    return ScrapeResult(
                        url=url,
                        title=title,
                        content_text=None,
                        html=html,
                        used_fallback=True,
                        artifact_dir=str(artifact_dir),
                        html_path=str(html_path),
                        screenshot_path=str(screenshot_path) if screenshot_path else None,
                    )

            return await asyncio.wait_for(run_once(), timeout=hard_timeout)
        except (PlaywrightTimeout, asyncio.TimeoutError, Exception) as exc:
            last_error = exc
            await asyncio.sleep(0.5)

    raise RuntimeError(f"Playwright failed for {url}") from last_error
