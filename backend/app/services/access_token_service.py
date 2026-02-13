import hashlib
import secrets
import uuid

from app.exceptions import NotFoundError
from app.models.api_key import ApiKey
from app.repositories.api_key_repo import ApiKeyRepository
from app.repositories.user_repo import UserRepository


class AccessTokenService:
    def __init__(self, session) -> None:
        self._users = UserRepository(session)
        self._keys = ApiKeyRepository(session)

    async def create_access_token(
        self,
        label: str | None,
        *,
        user_id: uuid.UUID | None = None,
    ) -> str:
        user = await self._resolve_user(user_id)
        if user is None:
            raise NotFoundError("No admin user configured")

        token = secrets.token_hex(16)
        key_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()

        api_key = ApiKey(
            key_hash=key_hash,
            user_id=user.id,
            label=label,
        )
        await self._keys.create(api_key)
        return token

    async def list_access_tokens(
        self,
        *,
        user_id: uuid.UUID | None = None,
    ) -> list[ApiKey]:
        user = await self._resolve_user(user_id)
        if user is None:
            raise NotFoundError("No admin user configured")
        return await self._keys.list_by_user(user.id)

    async def revoke_access_token(
        self,
        key_id: uuid.UUID,
        *,
        user_id: uuid.UUID | None = None,
    ) -> bool:
        user = await self._resolve_user(user_id)
        if user is None:
            raise NotFoundError("No admin user configured")

        key = await self._keys.get_by_id(key_id)
        if key is None or key.user_id != user.id:
            raise NotFoundError("Access token not found")
        return await self._keys.revoke(key.id)

    async def _resolve_user(self, user_id: uuid.UUID | None):
        if user_id is not None:
            user = await self._users.get_by_id(user_id)
            if user is not None:
                return user
        return await self._users.get_first()
