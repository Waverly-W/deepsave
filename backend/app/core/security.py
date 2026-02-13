import base64
import hashlib
import hmac
import json
import os
import time
from datetime import timedelta

import bcrypt

JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False


def create_access_token(subject: str) -> str:
    now = int(time.time())
    exp = now + int(timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS).total_seconds())
    header = {"alg": JWT_ALGORITHM, "typ": "JWT"}
    payload = {"sub": subject, "iat": now, "exp": exp}

    header_b64 = _b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_b64 = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")

    signature = hmac.new(_jwt_secret().encode("utf-8"), signing_input, hashlib.sha256).digest()
    signature_b64 = _b64url_encode(signature)

    return f"{header_b64}.{payload_b64}.{signature_b64}"


def decode_access_token(token: str) -> dict:
    try:
        header_b64, payload_b64, signature_b64 = token.split(".")
    except ValueError as exc:
        raise ValueError("Invalid token format") from exc

    signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")
    expected = hmac.new(_jwt_secret().encode("utf-8"), signing_input, hashlib.sha256).digest()

    if not hmac.compare_digest(_b64url_decode(signature_b64), expected):
        raise ValueError("Invalid token signature")

    payload = json.loads(_b64url_decode(payload_b64))
    if "exp" in payload and int(time.time()) > int(payload["exp"]):
        raise ValueError("Token expired")
    return payload


def _jwt_secret() -> str:
    secret = os.getenv("JWT_SECRET_KEY") or os.getenv("APP_SECRET_KEY")
    if not secret:
        raise RuntimeError("JWT secret is not configured")
    return secret


def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("utf-8")


def _b64url_decode(data: str) -> bytes:
    padding = "=" * ((4 - len(data) % 4) % 4)
    return base64.urlsafe_b64decode(data + padding)
