"""add api_keys lifecycle fields

Revision ID: 0017_api_keys_lifecycle
Revises: 0016_ai_prompt_settings
Create Date: 2026-02-13 15:10:00.000000
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "0017_api_keys_lifecycle"
down_revision = "0016_ai_prompt_settings"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "api_keys",
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "api_keys",
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "idx_api_keys_user_revoked",
        "api_keys",
        ["user_id", "revoked_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("idx_api_keys_user_revoked", table_name="api_keys")
    op.drop_column("api_keys", "last_used_at")
    op.drop_column("api_keys", "revoked_at")
