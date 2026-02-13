from __future__ import annotations

from datetime import datetime
import uuid

from pydantic import BaseModel, Field


class TagTreeItem(BaseModel):
    id: uuid.UUID
    title: str | None
    updated_at: datetime
    is_read: bool
    source_type: str


class TagTreeNode(BaseModel):
    id: int
    name: str
    path: str
    depth: int
    children: list["TagTreeNode"] = Field(default_factory=list)
    items: list[TagTreeItem] = Field(default_factory=list)


class TagTreeResponse(BaseModel):
    tree: list[TagTreeNode] = Field(default_factory=list)
