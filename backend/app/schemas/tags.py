from __future__ import annotations

from datetime import datetime
import uuid
from typing import Literal

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


class TagGraphNode(BaseModel):
    id: str
    label: str
    count: int
    is_center: bool


class TagGraphEdge(BaseModel):
    source: str
    target: str
    co_count: int
    weight: float


class TagGraphResponse(BaseModel):
    center_tag: str
    node_count: int
    edge_count: int
    nodes: list[TagGraphNode] = Field(default_factory=list)
    edges: list[TagGraphEdge] = Field(default_factory=list)


GraphMode = Literal["tag", "item"]
GraphNodeType = Literal["tag", "item"]
GraphEdgeType = Literal["hierarchy", "co_doc", "shared_tag"]


class RelationGraphNode(BaseModel):
    id: str
    label: str
    node_type: GraphNodeType
    count: int = 0


class RelationGraphEdge(BaseModel):
    id: str
    source: str
    target: str
    edge_type: GraphEdgeType
    shared_count: int = 1


class RelationGraphResponse(BaseModel):
    mode: GraphMode
    node_count: int
    edge_count: int
    nodes: list[RelationGraphNode] = Field(default_factory=list)
    edges: list[RelationGraphEdge] = Field(default_factory=list)
