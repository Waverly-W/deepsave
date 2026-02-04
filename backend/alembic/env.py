from logging.config import fileConfig
from sqlalchemy import engine_from_config
from sqlalchemy import pool
import asyncio
from alembic import context
import sys
import os

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from app.core.config import settings
from app.db.base import Base

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

def run_migrations_offline() -> None:
    url = settings.SQLALCHEMY_DATABASE_URI
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()

def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()

async def run_migrations_online() -> None:
    # Use Synchronous Engine for Alembic migration, or Async Engine with run_sync
    # Here we use the URI but create a sync engine for migration simplicity or use async engine adapter
    # For simplicity in this script, let's use the async engine + run_sync pattern
    
    from sqlalchemy.ext.asyncio import create_async_engine
    
    connectable = create_async_engine(
        settings.SQLALCHEMY_DATABASE_URI,
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    
    await connectable.dispose()

if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
