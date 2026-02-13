import hashlib
import os
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Literal

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_session
from app.core.security import decode_access_token
from app.repositories.api_key_repo import ApiKeyRepository
from app.repositories.user_repo import UserRepository

bearer_scheme = HTTPBearer(auto_error=False)


@dataclass(slots=True)
class AuthContext:
    user_id: uuid.UUID | None
    auth_type: Literal["jwt", "access_token", "bypass"]
    token_id: uuid.UUID | None = None


def _is_auth_enforced() -> bool:
    raw = os.getenv("AUTH_ENFORCED", "true").strip().lower()
    return raw not in {"0", "false", "no", "off"}


def _to_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _auth_error() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or missing credentials",
    )


async def require_auth(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    session: AsyncSession = Depends(get_async_session),
) -> AuthContext:
    if not _is_auth_enforced():
        return AuthContext(user_id=None, auth_type="bypass")

    if credentials is None or not credentials.credentials:
        raise _auth_error()

    token = credentials.credentials.strip()
    if not token:
        raise _auth_error()

    users = UserRepository(session)
    keys = ApiKeyRepository(session)

    try:
        payload = decode_access_token(token)
        user_id = uuid.UUID(str(payload.get("sub")))
    except (ValueError, TypeError):
        user_id = None

    if user_id is not None:
        user = await users.get_by_id(user_id)
        if user is None:
            raise _auth_error()

        issued_at = payload.get("iat")
        if issued_at is None:
            raise _auth_error()
        try:
            issued_at_value = int(issued_at)
        except (TypeError, ValueError):
            raise _auth_error() from None
        if user.last_password_reset_at is not None:
            issued_at_dt = datetime.fromtimestamp(issued_at_value, tz=timezone.utc)
            if issued_at_dt < _to_utc(user.last_password_reset_at):
                raise _auth_error()

        return AuthContext(user_id=user.id, auth_type="jwt")

    key_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    key = await keys.get_by_hash(key_hash)
    if key is None or key.revoked_at is not None:
        raise _auth_error()

    await keys.touch_last_used(key.id)
    return AuthContext(user_id=key.user_id, auth_type="access_token", token_id=key.id)
