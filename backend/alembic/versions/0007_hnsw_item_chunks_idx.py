"""add hnsw index for item_chunks embedding

Revision ID: 0007_hnsw_item_chunks_idx
Revises: 0006_item_chunks_table
Create Date: 2026-02-08
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "0007_hnsw_item_chunks_idx"
down_revision = "0006_item_chunks_table"
branch_labels = None
depends_on = None


INDEX_NAME = "idx_item_chunks_embedding_hnsw"


def upgrade() -> None:
    op.execute(
        f"""
        CREATE INDEX IF NOT EXISTS {INDEX_NAME}
        ON item_chunks
        USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
        """
    )


def downgrade() -> None:
    op.execute(f"DROP INDEX IF EXISTS {INDEX_NAME}")
