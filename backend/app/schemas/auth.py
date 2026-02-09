from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    password: str = Field(min_length=1)


class TokenResponse(BaseModel):
    token: str


class SetupRequest(BaseModel):
    password: str = Field(min_length=1)
