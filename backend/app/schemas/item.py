from typing import Optional
from pydantic import BaseModel, HttpUrl
from datetime import datetime
from uuid import UUID

class ItemBase(BaseModel):
    url: HttpUrl
    title: Optional[str] = None
    tags: Optional[list[str]] = []

class ItemCreate(ItemBase):
    pass

class ItemUpdate(ItemBase):
    pass

class ItemInDBBase(ItemBase):
    id: UUID
    owner_id: int
    created_at: datetime
    processing_status: str
    source_type: str

    class Config:
        from_attributes = True

class Item(ItemInDBBase):
    pass
