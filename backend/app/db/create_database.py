import sys

from sqlalchemy import create_engine, make_url, text
from sqlalchemy.exc import OperationalError

from app.config import Settings
from app.db import models
from app.db.session import build_engine

CONNECTION_ERROR = "Could not connect to Postgres. Check DATABASE_URL in backend/.env."


def create_database_if_missing(database_url: str) -> None:
    url = make_url(database_url)

    # CREATE DATABASE cannot run inside a transaction, or from the database being created.
    admin = create_engine(url.set(database="postgres"), isolation_level="AUTOCOMMIT")
    try:
        with admin.connect() as connection:
            exists = connection.execute(
                text("SELECT 1 FROM pg_database WHERE datname = :name"), {"name": url.database}
            ).first()

            if not exists:
                quoted_name = admin.dialect.identifier_preparer.quote(url.database)
                connection.execute(text(f"CREATE DATABASE {quoted_name}"))
    except OperationalError:
        sys.exit(CONNECTION_ERROR)
    finally:
        admin.dispose()


def create_tables(database_url: str) -> None:
    engine = build_engine(database_url)
    models.Base.metadata.create_all(engine)
    engine.dispose()


if __name__ == "__main__":
    database_url = Settings().database_url
    create_database_if_missing(database_url)
    create_tables(database_url)
