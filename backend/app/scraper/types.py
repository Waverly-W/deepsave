from dataclasses import dataclass


@dataclass
class ScrapeResult:
    url: str
    title: str | None
    content_text: str | None
    html: str | None
    used_fallback: bool
    artifact_dir: str | None = None
    html_path: str | None = None
    screenshot_path: str | None = None
