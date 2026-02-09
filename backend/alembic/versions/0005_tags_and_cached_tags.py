"""add tags tables and cached_tags

Revision ID: 0005_tags_and_cached_tags
Revises: 0004_items_table
Create Date: 2026-02-07
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "0005_tags_and_cached_tags"
down_revision = "0004_items_table"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("items", sa.Column("cached_tags", sa.Text(), nullable=True))

    op.create_table(
        "tags",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=50), nullable=False),
        sa.Column(
            "category",
            sa.String(length=20),
            server_default=sa.text("'general'"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        "uq_tags_name_category",
        "tags",
        [sa.text("lower(name)"), "category"],
        unique=True,
    )

    op.create_table(
        "item_tags",
        sa.Column("item_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tag_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["item_id"], ["items.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tag_id"], ["tags.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("item_id", "tag_id"),
    )


def downgrade() -> None:
    op.drop_table("item_tags")
    op.drop_index("uq_tags_name_category", table_name="tags")
    op.drop_table("tags")
    op.drop_column("items", "cached_tags")
