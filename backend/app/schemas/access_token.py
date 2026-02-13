import uuid
from datetime import datetime

from pydantic import BaseModel


class AccessTokenCreate(BaseModel):
    label: str | None = None


class AccessTokenResponse(BaseModel):
    access_token: str


class AccessTokenItem(BaseModel):
    id: uuid.UUID
    label: str | None = None
    created_at: datetime
    revoked_at: datetime | None = None
    last_used_at: datetime | None = None


class AccessTokenListResponse(BaseModel):
    items: list[AccessTokenItem]


class AccessTokenRevokeResponse(BaseModel):
    id: uuid.UUID
    revoked: bool
