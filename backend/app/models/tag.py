from sqlalchemy import ForeignKey, Integer, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    path: Mapped[str] = mapped_column(Text, nullable=False)
    depth: Mapped[int] = mapped_column(
        Integer, server_default=text("1"), nullable=False
    )
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("tags.id", ondelete="SET NULL"), nullable=True
    )
    category: Mapped[str] = mapped_column(
        String(20), server_default=text("'general'"), nullable=False
    )
