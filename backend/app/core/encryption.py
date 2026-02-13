import base64
import hashlib
import os

from cryptography.fernet import Fernet, InvalidToken


def encrypt_secret(value: str) -> str:
    fernet = _fernet()
    return fernet.encrypt(value.encode("utf-8")).decode("utf-8")


def decrypt_secret(token: str | None) -> str | None:
    if not token:
        return None
    fernet = _fernet()
    try:
        return fernet.decrypt(token.encode("utf-8")).decode("utf-8")
    except InvalidToken:
        return None


def _fernet() -> Fernet:
    raw_secret = os.getenv("APP_SECRET_KEY")
    if not raw_secret:
        raise RuntimeError("APP_SECRET_KEY is required for encryption")
    secret = raw_secret.encode("utf-8")
    digest = hashlib.sha256(secret).digest()
    key = base64.urlsafe_b64encode(digest)
    return Fernet(key)
