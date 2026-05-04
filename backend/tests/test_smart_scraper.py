import asyncio
import importlib
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


class SmartScraperTest(unittest.TestCase):
    def setUp(self) -> None:
        fake_http = types.ModuleType("app.scraper.http_scraper")
        fake_http.fetch_http = lambda url: types.SimpleNamespace(
            url=url,
            title="Fallback",
            content_text=None,
            html="<html></html>",
            used_fallback=False,
        )

        modules = {
            "app.scraper.http_scraper": fake_http,
        }

        self.patch = patch.dict(sys.modules, modules)
        self.patch.start()
        sys.modules.pop("app.scraper.smart_scraper", None)

    def tearDown(self) -> None:
        sys.modules.pop("app.scraper.smart_scraper", None)
        self.patch.stop()

    def test_returns_http_result_when_http_extraction_is_incomplete(self) -> None:
        smart_scraper = importlib.import_module("app.scraper.smart_scraper")

        result = asyncio.run(smart_scraper.scrape_url("https://example.test", item_id="1"))

        self.assertEqual(result.title, "Fallback")
        self.assertFalse(result.used_fallback)


if __name__ == "__main__":
    unittest.main()
