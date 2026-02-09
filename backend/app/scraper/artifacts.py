from pathlib import Path


def ensure_artifact_dir(item_id: str, base_dir: str = "/data/artifacts") -> Path:
    path = Path(base_dir) / item_id
    path.mkdir(parents=True, exist_ok=True)
    return path


def write_text(path: Path, content: str) -> None:
    path.write_text(content, encoding="utf-8")


def write_bytes(path: Path, content: bytes) -> None:
    path.write_bytes(content)
