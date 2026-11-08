from flask import Flask, current_app, g
from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import NullPool

SESSION_FACTORY_KEY = "db_session_factory"


def build_engine(database_url: str) -> Engine:
    # Serverless instances are short-lived, so pooling is left to the database's own pooler.
    return create_engine(
        database_url, poolclass=NullPool, connect_args={"prepare_threshold": None}
    )


def init_db(app: Flask, database_url: str) -> None:
    app.extensions[SESSION_FACTORY_KEY] = sessionmaker(
        bind=build_engine(database_url), expire_on_commit=False
    )

    @app.teardown_appcontext
    def close_db(_exception: BaseException | None) -> None:
        db = g.pop("db", None)
        if db is not None:
            db.close()


def get_db() -> Session:
    if "db" not in g:
        g.db = current_app.extensions[SESSION_FACTORY_KEY]()

    return g.db
