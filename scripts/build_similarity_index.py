#!/usr/bin/env python3
"""相似索引 + 重复簇构建管线（simhash + 字符 n-gram，纯本地）。

用法：DB_PATH=/path/to/data.db python3 scripts/build_similarity_index.py [--index-only|--clusters-only]
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app import db, similarity  # noqa: E402


def main():
    args = set(sys.argv[1:])
    conn = db.get_conn()
    similarity.ensure_tables(conn)
    if "--clusters-only" not in args:
        stats = similarity.build_index(conn, log=print)
        print(f"index: {stats['n']} questions in {stats['seconds']}s")
    if "--index-only" not in args:
        cstats = similarity.build_clusters(conn, log=print)
        print(
            f"clusters: {cstats['clusters']} clusters / {cstats['pairs']} dup pairs "
            f"from {cstats['n']} questions ({cstats['comparisons']} verified comparisons) "
            f"in {cstats['seconds']}s"
        )
    conn.close()


if __name__ == "__main__":
    main()
