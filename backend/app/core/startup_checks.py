import base64
import os

_WEAK_SECRET_VALUES = {
    "change-me",
    "changeme",
    "password",
    "secret",
    "123456",
}


def _is_truthy(raw: str | None) -> bool:
    if raw is None:
        return False
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _is_base64_bytes(raw: str) -> bool:
    try:
        padding = "=" * ((4 - len(raw) % 4) % 4)
        decoded = base64.urlsafe_b64decode(f"{raw}{padding}".encode("utf-8"))
    except Exception:
        return False
    return len(decoded) >= 32


def validate_app_secret() -> None:
    secret = (os.getenv("APP_SECRET_KEY") or "").strip()
    allow_weak = _is_truthy(os.getenv("ALLOW_WEAK_SECRET_FOR_DEV"))
    if not secret:
        raise RuntimeError("APP_SECRET_KEY is required")
    if allow_weak:
        return
    if secret.lower() in _WEAK_SECRET_VALUES:
        raise RuntimeError("APP_SECRET_KEY is too weak")
    if len(secret) < 32 and not _is_base64_bytes(secret):
        raise RuntimeError(
            "APP_SECRET_KEY must be at least 32 characters or base64-encoded 32 bytes"
        )


def run_startup_checks() -> None:
    validate_app_secret()
