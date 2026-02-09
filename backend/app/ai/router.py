from __future__ import annotations

from pathlib import Path
from urllib.parse import urlparse

import yaml

DEFAULT_RULES_PATH = Path("config/router_rules.yaml")


def load_rules(path: Path = DEFAULT_RULES_PATH) -> dict:
    if not path.exists():
        return {}
    return yaml.safe_load(path.read_text(encoding="utf-8")) or {}


def route_url(url: str, *, override: str | None = None, rules: dict | None = None) -> str:
    if override:
        return override

    parsed = urlparse(url)
    host = parsed.netloc.lower()
    suffix = Path(parsed.path.lower()).suffix

    if rules is None:
        rules = load_rules()

    image_suffixes = set(rules.get("image_suffixes", []))
    domain_map = rules.get("domain_map", {})

    if suffix and suffix in image_suffixes:
        return "image"

    for domain, mapped in domain_map.items():
        if host.endswith(domain):
            return mapped

    return "article"
