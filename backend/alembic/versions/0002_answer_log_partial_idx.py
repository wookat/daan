"""answer_log partial index for uid+question_id lookups

Revision ID: 0002_answer_log_partial_idx
Revises: 0001_baseline
Create Date: 2026-10-03

Covers the hot `uid=? AND question_id IS NOT NULL` filters in db.py
(per-user distinct question ids, attempt-sequence scans). The existing
idx_al_uid is (uid, created_at), which still scans every historical row;
the partial index skips them directly.
"""
from alembic import op

revision = "0002_answer_log_partial_idx"
down_revision = "0001_baseline"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    exists = conn.exec_driver_sql(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='answer_log'"
    ).scalar()
    if not exists:
        # Fresh/test DB without answer_log yet: stamp and move on; the table's own
        # init path creates it (and init_db already covers the core indexes).
        return
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_al_uid_qid ON answer_log(uid, question_id) "
        "WHERE question_id IS NOT NULL"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_al_uid_qid")
