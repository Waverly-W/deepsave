from typing import Optional
from pydantic import BaseModel, EmailStr

# Token
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenPayload(BaseModel):
    sub: Optional[int] = None

# User Shared Properties
class UserBase(BaseModel):
    email: Optional[EmailStr] = None
    is_active: Optional[bool] = True
    is_superuser: Optional[bool] = False

# Properties to receive via API on creation
class UserCreate(UserBase):
    email: EmailStr
    password: str

# Properties to return to client
class User(UserBase):
    id: int
    
    class Config:
        from_attributes = True

# Login
class Login2FARequest(BaseModel):
    username: str
    password: str
    totp_code: Optional[str] = None # Optional for first step, required for final check if 2FA enabled
