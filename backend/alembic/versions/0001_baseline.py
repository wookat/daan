"""baseline: existing schema (all tables created by app.db.init_db)

Revision ID: 0001_baseline
Revises:
Create Date: 2026-10-03

Empty anchor revision: init_db's CREATE TABLE IF NOT EXISTS + check-and-add-column
blocks define the baseline. Existing DBs apply 0001 as a no-op marker; fresh DBs run
init_db first, then upgrade. All future schema changes go in new revisions, not init_db.
"""
from alembic import op  # noqa: F401

revision = "0001_baseline"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
