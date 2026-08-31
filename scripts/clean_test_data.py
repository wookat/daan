"""清理迭代验证遗留的测试 uid 数据。

用法（生产容器内）：
  python scripts/clean_test_data.py /data/data.db            # dry-run，只打印
  python scripts/clean_test_data.py /data/data.db --apply    # 实际删除

判定标准（保守，两类并集）：
1. 命名模式：uid 匹配 ^(r\\d+|uR\\d+)、qa- 段，或含 tmp/test/probe/chk —— 迭代验证脚本的命名约定。
2. 机器速答爆发：answer_log 中 n>=10 且全部 secs<=2 且时间跨度 <=60s（仅删该 uid 数据）。

保护：PROTECTED 列表内 uid 永不删除；机器速答类（标准2）额外豁免 user_profile 已登录 uid，
命名模式类（标准1）不豁免——登录流程测试账号连 profile 一并清理。
"""

import re
import sqlite3
import sys

PROTECTED = {"umteojq4sltdhorhm"}
PATTERN = re.compile(r"(^r\d+)|(^uR\d+)|(^|[-_])qa[-_]|tmp|test|probe|chk", re.IGNORECASE)

UID_TABLES = [
    "mistakes", "question_reports", "answer_log", "shenlun_answers",
    "shenlun_mat_favs", "user_state", "exam_attempts", "review_log",
    "question_comments", "comment_likes", "fav_folders", "question_favs",
    "question_notes", "interview_sessions", "mock_event_entries",
    "weekly_reports", "reinforce_log", "team_members", "shared_answers",
    "growth_events", "reminder_prefs", "comment_reports",
    "comment_inbox_reads", "daily_set_entries", "push_subs", "user_profile",
]


def main():
    db = sys.argv[1]
    apply = "--apply" in sys.argv
    c = sqlite3.connect(db)
    logged_in = {r[0] for r in c.execute("SELECT uid FROM user_profile")}

    targets = set()
    all_uids = set()
    for t in UID_TABLES:
        try:
            all_uids |= {r[0] for r in c.execute(f"SELECT DISTINCT uid FROM {t}") if r[0]}
        except sqlite3.OperationalError:
            pass
    for uid in all_uids:
        if uid in PROTECTED:
            continue
        if PATTERN.search(uid):
            targets.add(uid)
    for uid, n, mn, mx, fast in c.execute(
        "SELECT uid,COUNT(*),MIN(created_at),MAX(created_at),"
        "SUM(CASE WHEN secs<=2 THEN 1 ELSE 0 END) FROM answer_log GROUP BY uid"
    ):
        if uid in PROTECTED or uid in logged_in or not uid:
            continue
        if n >= 10 and fast == n and (mx - mn) <= 60:
            targets.add(uid)

    print(f"targets ({len(targets)}):", sorted(targets))
    ph = ",".join("?" * len(targets))
    total = 0
    for t in UID_TABLES:
        try:
            n = c.execute(f"SELECT COUNT(*) FROM {t} WHERE uid IN ({ph})", list(targets)).fetchone()[0]
        except sqlite3.OperationalError:
            continue
        if n:
            print(f"  {t}: {n} rows")
            total += n
            if apply:
                c.execute(f"DELETE FROM {t} WHERE uid IN ({ph})", list(targets))
    if apply:
        c.commit()
        print(f"DELETED {total} rows")
    else:
        print(f"dry-run: would delete {total} rows (pass --apply to delete)")


if __name__ == "__main__":
    main()
