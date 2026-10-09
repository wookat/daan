"""Run `alembic upgrade head` at startup.

init_db() guarantees the baseline schema (CREATE TABLE IF NOT EXISTS); this applies
post-baseline incremental migrations to head. A failed migration raises and blocks
startup rather than running on a partial schema.
"""

import os

from alembic.config import Config

from alembic import command

_ALEMBIC_INI = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "alembic.ini")


def run_migrations() -> None:
    cfg = Config(_ALEMBIC_INI)
    command.upgrade(cfg, "head")
