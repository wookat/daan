"""performance indexes for hot queries and admin/community/exam paths

Revision ID: 0003_perf_indexes
Revises: 0002_answer_log_partial_idx
Create Date: 2026-11-24

Adds composite covering/lookup indexes idempotently (checks table presence in
sqlite_master first so partial/test schemas stamp cleanly).
"""
from alembic import op

revision = "0003_perf_indexes"
down_revision = "0002_answer_log_partial_idx"
branch_labels = None
depends_on = None

_INDEXES = (
    ("mistakes", "CREATE INDEX IF NOT EXISTS idx_mist_uid_qid ON mistakes(uid, question_id) WHERE question_id IS NOT NULL"),
    ("mistakes", "CREATE INDEX IF NOT EXISTS idx_mist_uid_due ON mistakes(uid, mastered, next_review, created_at)"),
    ("answer_log", "CREATE INDEX IF NOT EXISTS idx_al_created ON answer_log(created_at, probe)"),
    ("questions", "CREATE INDEX IF NOT EXISTS idx_q_mod_sub_id ON questions(module, submodule, disabled, id)"),
    ("exam_attempts", "CREATE INDEX IF NOT EXISTS idx_ea_paper_sub ON exam_attempts(paper_id, submitted_at, uid)"),
    ("zalize_bindings", "CREATE INDEX IF NOT EXISTS idx_zb_uid ON zalize_bindings(user_id)"),
    ("daily_set_entries", "CREATE INDEX IF NOT EXISTS idx_dse_uid_day ON daily_set_entries(uid, day)"),
    ("shenlun_questions", "CREATE INDEX IF NOT EXISTS idx_sq_list ON shenlun_questions(disabled, exam_year, exam_region, qtype, id)"),
    ("shenlun_materials", "CREATE INDEX IF NOT EXISTS idx_sm_type ON shenlun_materials(disabled, type, id)"),
    ("question_comments", "CREATE INDEX IF NOT EXISTS idx_qc_plaza ON question_comments(status, created_at)"),
)


def upgrade() -> None:
    conn = op.get_bind()
    tables = {
        r[0]
        for r in conn.exec_driver_sql("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
    }
    for tbl, ddl in _INDEXES:
        if tbl in tables:
            op.execute(ddl)


def downgrade() -> None:
    for name in (
        "idx_mist_uid_qid",
        "idx_mist_uid_due",
        "idx_al_created",
        "idx_q_mod_sub_id",
        "idx_ea_paper_sub",
        "idx_zb_uid",
        "idx_dse_uid_day",
        "idx_sq_list",
        "idx_sm_type",
        "idx_qc_plaza",
    ):
        op.execute(f"DROP INDEX IF EXISTS {name}")
