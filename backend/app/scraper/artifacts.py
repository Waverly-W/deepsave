import os
from pathlib import Path


def resolve_artifacts_base_dir() -> Path:
    base_dir = os.getenv("ARTIFACTS_BASE_DIR", "/data/artifacts").strip()
    return Path(base_dir or "/data/artifacts")


def ensure_artifact_dir(item_id: str, base_dir: str | None = None) -> Path:
    root = Path(base_dir) if base_dir else resolve_artifacts_base_dir()
    path = root / item_id
    path.mkdir(parents=True, exist_ok=True)
    return path


def write_text(path: Path, content: str) -> None:
    path.write_text(content, encoding="utf-8")


def write_bytes(path: Path, content: bytes) -> None:
    path.write_bytes(content)
