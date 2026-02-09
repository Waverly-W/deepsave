"""add content_search_vector generated column and gin index

Revision ID: 0009_content_search_vector
Revises: 0008_trgm_title_tags_index
Create Date: 2026-02-08
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "0009_content_search_vector"
down_revision = "0008_trgm_title_tags_index"
branch_labels = None
depends_on = None


INDEX_NAME = "idx_items_content_search_vector"


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE items
        ADD COLUMN IF NOT EXISTS content_search_vector tsvector
        GENERATED ALWAYS AS (to_tsvector('simple', coalesce(content_tokens, ''))) STORED
        """
    )
    op.execute(
        f"""
        CREATE INDEX IF NOT EXISTS {INDEX_NAME}
        ON items USING gin (content_search_vector)
        """
    )


def downgrade() -> None:
    op.execute(f"DROP INDEX IF EXISTS {INDEX_NAME}")
    op.execute("ALTER TABLE items DROP COLUMN IF EXISTS content_search_vector")
