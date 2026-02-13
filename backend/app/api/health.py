import asyncio

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_session
from app.core.redis import get_redis
from app.worker.celery_app import celery_app

router = APIRouter()


@router.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@router.get("/health/liveness")
async def liveness() -> dict:
    return {"status": "ok"}


@router.get("/health/readiness")
async def readiness(
    session: AsyncSession = Depends(get_async_session),
) -> dict:
    redis = get_redis()
    try:
        await session.execute(text("SELECT 1"))
        await redis.ping()
        await asyncio.to_thread(_check_celery_broker)
        return {"status": "ready"}
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Service not ready: {exc}",
        ) from exc
    finally:
        await redis.close()


def _check_celery_broker() -> None:
    with celery_app.connection_for_read() as connection:
        connection.ensure_connection(max_retries=1)
