"""add content format and migrate to html

Revision ID: 0014_add_content_format_html
Revises: 0013_item_revisions
Create Date: 2026-02-09 20:20:00.000000
"""

from alembic import op
import sqlalchemy as sa
from markdown_it import MarkdownIt

# revision identifiers, used by Alembic.
revision = "0014_add_content_format_html"
down_revision = "0013_item_revisions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "items",
        sa.Column("content_format", sa.String(length=20), server_default="html", nullable=False),
    )

    conn = op.get_bind()
    md = MarkdownIt("commonmark", {"html": True, "linkify": True, "breaks": True})
    result = conn.execute(
        sa.text("SELECT id, content_text FROM items WHERE content_text IS NOT NULL")
    )
    rows = result.fetchall()
    for row in rows:
        content_text = row.content_text
        if content_text is None:
            continue
        html = md.render(content_text).strip()
        conn.execute(
            sa.text(
                "UPDATE items SET content_text = :content_text, content_format = 'html' WHERE id = :id"
            ),
            {"content_text": html, "id": row.id},
        )


def downgrade() -> None:
    op.drop_column("items", "content_format")
