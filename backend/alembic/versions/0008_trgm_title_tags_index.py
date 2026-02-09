"""add pg_trgm indexes for items title and cached_tags

Revision ID: 0008_trgm_title_tags_index
Revises: 0007_hnsw_item_chunks_idx
Create Date: 2026-02-08
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "0008_trgm_title_tags_index"
down_revision = "0007_hnsw_item_chunks_idx"
branch_labels = None
depends_on = None


INDEX_TITLE = "idx_items_title_trgm"
INDEX_TAGS = "idx_items_cached_tags_trgm"


def upgrade() -> None:
    op.execute(
        f"""
        CREATE INDEX IF NOT EXISTS {INDEX_TITLE}
        ON items USING gin (title gin_trgm_ops)
        """
    )
    op.execute(
        f"""
        CREATE INDEX IF NOT EXISTS {INDEX_TAGS}
        ON items USING gin (cached_tags gin_trgm_ops)
        """
    )


def downgrade() -> None:
    op.execute(f"DROP INDEX IF EXISTS {INDEX_TAGS}")
    op.execute(f"DROP INDEX IF EXISTS {INDEX_TITLE}")
