from __future__ import annotations

import os
from dataclasses import dataclass
from collections.abc import Mapping


DEFAULT_CORS_ORIGINS = (
    "http://127.0.0.1:10100,"
    "http://localhost:10100,"
    "http://127.0.0.1:3000,"
    "http://localhost:3000"
)
DEFAULT_PRIVATE_NETWORK_ORIGIN_REGEX = (
    r"https?://("
    r"localhost|"
    r"127\.0\.0\.1|"
    r"10(?:\.\d{1,3}){3}|"
    r"192\.168(?:\.\d{1,3}){2}|"
    r"172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2}"
    r")(?::\d+)?"
)


@dataclass(frozen=True)
class CorsConfig:
    allow_origins: list[str]
    allow_origin_regex: str | None


def get_cors_config(env: Mapping[str, str] | None = None) -> CorsConfig:
    source = env if env is not None else os.environ
    origins_raw = source.get("CORS_ALLOW_ORIGINS", DEFAULT_CORS_ORIGINS)
    allow_origins = [origin.strip() for origin in origins_raw.split(",") if origin.strip()]
    allow_origin_regex = source.get(
        "CORS_ALLOW_ORIGIN_REGEX",
        DEFAULT_PRIVATE_NETWORK_ORIGIN_REGEX,
    )
    if allow_origin_regex == "":
        allow_origin_regex = DEFAULT_PRIVATE_NETWORK_ORIGIN_REGEX
    return CorsConfig(
        allow_origins=allow_origins,
        allow_origin_regex=allow_origin_regex,
    )
