-- Placeholder schema — real migrations managed by SQLAlchemy/Alembic later

CREATE TABLE IF NOT EXISTS users (
    id          SERIAL PRIMARY KEY,
    username    VARCHAR(50) UNIQUE NOT NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
