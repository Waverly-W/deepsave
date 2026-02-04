from playwright.async_api import async_playwright
import asyncio

class BrowserClient:
    @staticmethod
    async def fetch_snapshot(url: str, output_path: str):
        async with async_playwright() as p:
            # Launch compatible browser
            # We use chromium in docker
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox', '--disable-setuid-sandbox'])
            page = await browser.new_page()
            
            try:
                await page.goto(url, wait_until="networkidle", timeout=30000)
                # Take screenshot
                await page.screenshot(path=f"{output_path}/screenshot.png", full_page=True)
                # Get Content
                content = await page.content()
                
                return {"content": content, "status": "success"}
            except Exception as e:
                return {"error": str(e), "status": "failed"}
            finally:
                await browser.close()
