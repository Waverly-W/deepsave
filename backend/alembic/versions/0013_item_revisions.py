"""add item revisions

Revision ID: 0013_item_revisions
Revises: 0012_ai_settings_table
Create Date: 2026-02-09 12:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "0013_item_revisions"
down_revision = "0012_ai_settings_table"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "items",
        sa.Column("content_revision", sa.Integer(), server_default="0", nullable=False),
    )
    op.add_column(
        "items",
        sa.Column("analysis_revision", sa.Integer(), server_default="0", nullable=False),
    )
    op.add_column(
        "items",
        sa.Column("processing_target_revision", sa.Integer(), nullable=True),
    )
    op.execute(
        """
        UPDATE items
        SET content_revision = CASE
            WHEN content_text IS NULL OR content_text = '' THEN 0
            ELSE 1
        END,
        analysis_revision = CASE
            WHEN processing_status = 'completed'
                 AND content_text IS NOT NULL
                 AND content_text <> '' THEN 1
            ELSE 0
        END
        """
    )


def downgrade() -> None:
    op.drop_column("items", "processing_target_revision")
    op.drop_column("items", "analysis_revision")
    op.drop_column("items", "content_revision")
