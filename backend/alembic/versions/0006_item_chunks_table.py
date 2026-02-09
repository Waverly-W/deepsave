"""add item_chunks table

Revision ID: 0006_item_chunks_table
Revises: 0005_tags_and_cached_tags
Create Date: 2026-02-07
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from pgvector.sqlalchemy import Vector

# revision identifiers, used by Alembic.
revision = "0006_item_chunks_table"
down_revision = "0005_tags_and_cached_tags"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "item_chunks",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "item_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("items.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("chunk_text", sa.Text(), nullable=True),
        sa.Column("embedding", Vector(1024), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("item_chunks")
