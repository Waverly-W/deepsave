from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_session
from app.exceptions import UnauthorizedError
from app.schemas.auth import LoginRequest, SetupRequest, TokenResponse
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/login", response_model=TokenResponse)
async def login(
    payload: LoginRequest,
    session: AsyncSession = Depends(get_async_session),
) -> TokenResponse:
    service = AuthService(session)
    try:
        token = await service.login(payload.password)
        return TokenResponse(token=token)
    except UnauthorizedError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc


@router.post("/setup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def setup_admin(
    payload: SetupRequest,
    session: AsyncSession = Depends(get_async_session),
) -> TokenResponse:
    service = AuthService(session)
    try:
        token = await service.setup_admin(payload.password)
        return TokenResponse(token=token)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
