import uuid

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.api_key import ApiKey


class ApiKeyRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(self, api_key: ApiKey) -> ApiKey:
        self._session.add(api_key)
        await self._session.flush()
        await self._session.refresh(api_key)
        return api_key

    async def get_by_hash(self, key_hash: str) -> ApiKey | None:
        result = await self._session.execute(
            select(ApiKey).where(ApiKey.key_hash == key_hash)
        )
        return result.scalar_one_or_none()

    async def get_by_id(self, key_id: uuid.UUID) -> ApiKey | None:
        result = await self._session.execute(select(ApiKey).where(ApiKey.id == key_id))
        return result.scalar_one_or_none()

    async def list_by_user(self, user_id: uuid.UUID) -> list[ApiKey]:
        result = await self._session.execute(
            select(ApiKey)
            .where(ApiKey.user_id == user_id)
            .order_by(ApiKey.created_at.desc())
        )
        return list(result.scalars().all())

    async def touch_last_used(self, key_id: uuid.UUID) -> None:
        await self._session.execute(
            update(ApiKey).where(ApiKey.id == key_id).values(last_used_at=func.now())
        )

    async def revoke(
        self,
        key_id: uuid.UUID,
        *,
        revoked_at=None,
    ) -> bool:
        when = revoked_at or func.now()
        result = await self._session.execute(
            update(ApiKey)
            .where(ApiKey.id == key_id)
            .where(ApiKey.revoked_at.is_(None))
            .values(revoked_at=when)
        )
        return bool(result.rowcount and result.rowcount > 0)
