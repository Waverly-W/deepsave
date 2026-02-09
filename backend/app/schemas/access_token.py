from pydantic import BaseModel


class AccessTokenCreate(BaseModel):
    label: str | None = None


class AccessTokenResponse(BaseModel):
    access_token: str
