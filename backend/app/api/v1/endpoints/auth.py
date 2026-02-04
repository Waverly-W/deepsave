from typing import Any
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
import pyotp

from app.api import deps
from app.core import security
from app.core.config import settings
from app.models.user import User
from app.schemas.user import Token, Login2FARequest

router = APIRouter()

@router.post("/login/access-token", response_model=Token)
async def login_access_token(
    form_data: Login2FARequest, # Using custom schema instead of OAuth2PasswordRequestForm to support JSON body with totp_code
    db: AsyncSession = Depends(deps.get_db),
) -> Any:
    """
    OAuth2 compatible token login, get an access token for future requests.
    Supports 2FA.
    """
    # 1. Check User
    result = await db.execute(select(User).where(User.email == form_data.username))
    user = result.scalars().first()
    
    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")

    # 2. Check 2FA
    if user.totp_secret:
        if not form_data.totp_code:
            # Client should catch this 401 and prompt for 2FA code
            raise HTTPException(
                status_code=401, 
                detail="2FA_REQUIRED",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        totp = pyotp.TOTP(user.totp_secret)
        if not totp.verify(form_data.totp_code):
            raise HTTPException(status_code=400, detail="Invalid 2FA Code")

    # 3. Issue Token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return {
        "access_token": security.create_access_token(
            user.id, expires_delta=access_token_expires
        ),
        "token_type": "bearer",
    }
