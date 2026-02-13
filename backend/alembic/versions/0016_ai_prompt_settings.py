"""add ai prompt setting fields

Revision ID: 0016_ai_prompt_settings
Revises: 0015_tag_hierarchy
Create Date: 2026-02-13 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "0016_ai_prompt_settings"
down_revision = "0015_tag_hierarchy"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "ai_settings",
        sa.Column("summary_system_prompt", sa.Text(), nullable=True),
    )
    op.add_column(
        "ai_settings",
        sa.Column("summary_user_prompt_template", sa.Text(), nullable=True),
    )
    op.add_column(
        "ai_settings",
        sa.Column("polish_system_prompt", sa.Text(), nullable=True),
    )
    op.add_column(
        "ai_settings",
        sa.Column("polish_user_prompt_template", sa.Text(), nullable=True),
    )
    op.add_column(
        "ai_settings",
        sa.Column("vision_user_prompt", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("ai_settings", "vision_user_prompt")
    op.drop_column("ai_settings", "polish_user_prompt_template")
    op.drop_column("ai_settings", "polish_system_prompt")
    op.drop_column("ai_settings", "summary_user_prompt_template")
    op.drop_column("ai_settings", "summary_system_prompt")
