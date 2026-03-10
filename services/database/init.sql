-- Placeholder schema — real migrations managed by SQLAlchemy/Alembic later

-- USERS

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE,
    password_hash TEXT,
    status VARCHAR(20) DEFAULT 'offline',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- MATCHES

CREATE TABLE IF NOT EXISTS matches (
    id SERIAL PRIMARY KEY,

    player1_id INT REFERENCES users(id),
    player2_id INT REFERENCES users(id),
    winner_id INT REFERENCES users(id),

    score_p1 INT DEFAULT 0,
    score_p2 INT DEFAULT 0,

    started_at TIMESTAMP,
    finished_at TIMESTAMP,

    status VARCHAR(20)
);


-- CHAT ROOMS

CREATE TABLE IF NOT EXISTS chat_rooms (
    id SERIAL PRIMARY KEY,
    room_name VARCHAR(100),
    room_type VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- MESSAGES

CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,

    room_id INT REFERENCES chat_rooms(id),
    user_id INT REFERENCES users(id),

    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);