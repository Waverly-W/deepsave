"""add is_read to items

Revision ID: 0010_add_is_read
Revises: 0009_content_search_vector
Create Date: 2026-02-08
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "0010_add_is_read"
down_revision = "0009_content_search_vector"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "items",
        sa.Column("is_read", sa.Boolean(), server_default=sa.text("false"), nullable=False),
    )


def downgrade() -> None:
    op.drop_column("items", "is_read")
