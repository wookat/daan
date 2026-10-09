"""Alembic env: single-file SQLite, URL taken from app.db.DB_PATH (same source as runtime).

Baseline schema is guaranteed by app.db.init_db()'s CREATE TABLE IF NOT EXISTS
(0001 is an empty anchor revision). All incremental schema changes after that are
written as migrations, not ALTERs inside init_db.
"""

from logging.config import fileConfig

from sqlalchemy import create_engine

from alembic import context

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Same path resolution as the app (DB_PATH env > backend/../data.db)
from app.db import DB_PATH

config.set_main_option("sqlalchemy.url", "sqlite:///" + DB_PATH.replace("\\", "/"))


def run_migrations_offline() -> None:
    context.configure(
        url=config.get_main_option("sqlalchemy.url"),
        target_metadata=None,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    engine = create_engine(config.get_main_option("sqlalchemy.url"))
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=None)
        with context.begin_transaction():
            context.run_migrations()
    engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
