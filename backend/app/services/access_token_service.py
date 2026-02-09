import hashlib
import secrets

from app.exceptions import NotFoundError
from app.models.api_key import ApiKey
from app.repositories.api_key_repo import ApiKeyRepository
from app.repositories.user_repo import UserRepository


class AccessTokenService:
    def __init__(self, session) -> None:
        self._users = UserRepository(session)
        self._keys = ApiKeyRepository(session)

    async def create_access_token(self, label: str | None) -> str:
        user = await self._users.get_first()
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
