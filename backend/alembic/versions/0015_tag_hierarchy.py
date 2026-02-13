"""add tag hierarchy fields

Revision ID: 0015_tag_hierarchy
Revises: 0014_add_content_format_html
Create Date: 2026-02-10
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "0015_tag_hierarchy"
down_revision = "0014_add_content_format_html"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("tags", sa.Column("parent_id", sa.Integer(), nullable=True))
    op.add_column("tags", sa.Column("path", sa.Text(), nullable=True))
    op.add_column(
        "tags",
        sa.Column("depth", sa.Integer(), server_default="1", nullable=False),
    )
    op.create_foreign_key(
        "fk_tags_parent_id",
        "tags",
        "tags",
        ["parent_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.execute("UPDATE tags SET path = name WHERE path IS NULL")
    op.alter_column("tags", "path", nullable=False)

    op.drop_index("uq_tags_name_category", table_name="tags")
    op.create_index(
        "uq_tags_path_category",
        "tags",
        [sa.text("lower(path)"), "category"],
        unique=True,
    )
    op.create_index("ix_tags_parent_id", "tags", ["parent_id"])


def downgrade() -> None:
    op.drop_index("ix_tags_parent_id", table_name="tags")
    op.drop_index("uq_tags_path_category", table_name="tags")
    op.create_index(
        "uq_tags_name_category",
        "tags",
        [sa.text("lower(name)"), "category"],
        unique=True,
    )
    op.drop_constraint("fk_tags_parent_id", "tags", type_="foreignkey")
    op.drop_column("tags", "depth")
    op.drop_column("tags", "path")
    op.drop_column("tags", "parent_id")
