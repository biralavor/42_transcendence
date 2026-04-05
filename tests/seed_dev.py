#!/usr/bin/env python3
"""
Dev seed script — fills users, credentials, friendships, matches, and chat rooms.

Usage (from repo root):
    make seed

Or manually:
    docker compose cp tests/seed_dev.py user-service:/app/seed_dev.py
    docker compose exec user-service python3 /app/seed_dev.py

Test accounts created:
    username: alice   password: 123dev   id: (auto)
    username: bob     password: 123dev   id: (auto)
    username: charlie password: 123dev   id: (auto)
    username: joao    password: 123dev   id: (auto)
    username: maria   password: 123dev   id: (auto)

Friendships seeded:
    alice   <-> bob     → accepted
    alice   <-> charlie → accepted
    alice   <-> joao    → accepted
    maria   ->  alice   → pending
    bob     <-> charlie → accepted
    joao    ->  bob     → pending
    bob     <-> maria   → accepted
    charlie <-> joao    → accepted
    charlie ->  maria   → pending
    joao    <-> maria   → accepted

Chat rooms seeded (fixed slugs used by TranscendenceHealthCheck.sh):
    hc-hist   → 2 messages: first-msg (Alice), second-msg (Bob)
    hc-limit  → 20 messages msg0…msg19  (health-check limit test requires 20)
    hc-iso-a  → 2 messages: secret-a, hello-a (Alice)
    hc-iso-b  → empty room (isolation test counterpart)
    hc-order  → 3 messages: alpha, beta, gamma  (health-check order test requires 3)
"""

import asyncio
import os
import bcrypt
from datetime import datetime, timezone
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

# ── DB URL — built from the same DB_* vars used by all services ─────
DATABASE_URL = "postgresql+asyncpg://{}:{}@{}:{}/{}".format(
    os.environ.get("DB_USER",     "postgres"),
    os.environ.get("DB_PASSWORD", "postgres"),
    os.environ.get("DB_HOST",     "db"),
    os.environ.get("DB_PORT",     "5432"),
    os.environ.get("DB_NAME",     "transcendence_db"),
)


def _hash(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


USERS = [
    dict(username="alice",   display_name="Alice",   status="online",  bio="Hi, I'm Alice!",        avatar_url=None),
    dict(username="bob",     display_name="Bob",     status="offline", bio="Bob here.",              avatar_url=None),
    dict(username="charlie", display_name="Charlie", status="online",  bio="Charlie checking in.",   avatar_url=None),
    dict(username="joao",    display_name="João",    status="online",  bio="João aqui!",             avatar_url=None),
    dict(username="maria",   display_name="Maria",   status="offline", bio="Hey, I'm Maria.",        avatar_url=None),
]

PASSWORD = "123dev"

# (requester, addressee, status)
FRIENDSHIPS = [
    ("alice",   "bob",     "accepted"),
    ("alice",   "charlie", "accepted"),
    ("alice",   "joao",    "accepted"),
    ("maria",   "alice",   "pending"),
    ("bob",     "charlie", "accepted"),
    ("joao",    "bob",     "pending"),
    ("bob",     "maria",   "accepted"),
    ("charlie", "joao",    "accepted"),
    ("charlie", "maria",   "pending"),
    ("joao",    "maria",   "accepted"),
]


def dt(s):
    return datetime.strptime(s, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)


# (p1_username, p2_username, winner_username, s1, s2, started, finished)
MATCHES = [
    ("alice",   "bob",     "alice",   11,  7,  dt("2026-03-14 20:00:00"), dt("2026-03-14 20:12:00")),
    ("bob",     "alice",   "bob",     11,  9,  dt("2026-03-15 18:30:00"), dt("2026-03-15 18:45:00")),
    ("alice",   "charlie", "alice",   11,  4,  dt("2026-03-16 21:00:00"), dt("2026-03-16 21:10:00")),
    ("charlie", "bob",     "charlie", 11,  8,  dt("2026-03-17 19:00:00"), dt("2026-03-17 19:13:00")),
    ("alice",   "bob",     "alice",   11,  6,  dt("2026-03-18 20:00:00"), dt("2026-03-18 20:11:00")),
    ("joao",    "alice",   "joao",    11,  3,  dt("2026-03-19 15:00:00"), dt("2026-03-19 15:10:00")),
    ("maria",   "bob",     "maria",   11,  5,  dt("2026-03-20 17:00:00"), dt("2026-03-20 17:12:00")),
    ("charlie", "joao",    "joao",    9,   11, dt("2026-03-21 20:00:00"), dt("2026-03-21 20:14:00")),
    ("maria",   "alice",   "alice",   7,   11, dt("2026-03-22 19:00:00"), dt("2026-03-22 19:11:00")),
    ("bob",     "joao",    "bob",     11,  10, dt("2026-03-23 21:00:00"), dt("2026-03-23 21:18:00")),
    ("joao",    "maria",   "joao",    11,  6,  dt("2026-03-24 16:00:00"), dt("2026-03-24 16:09:00")),
    ("alice",   "maria",   "alice",   11,  4,  dt("2026-03-25 20:00:00"), dt("2026-03-25 20:10:00")),
    ("charlie", "maria",   "charlie", 11,  7,  dt("2026-03-26 18:00:00"), dt("2026-03-26 18:13:00")),
    ("bob",     "charlie", "bob",     11,  9,  dt("2026-03-27 20:00:00"), dt("2026-03-27 20:15:00")),
    ("maria",   "joao",    "maria",   11,  8,  dt("2026-03-28 19:00:00"), dt("2026-03-28 19:12:00")),
    ("alice",   "joao",    "alice",   11,  5,  dt("2026-03-29 21:00:00"), dt("2026-03-29 21:09:00")),
    ("joao",    "charlie", "charlie", 8,   11, dt("2026-03-30 17:00:00"), dt("2026-03-30 17:14:00")),
    ("maria",   "charlie", "maria",   11,  9,  dt("2026-03-31 20:00:00"), dt("2026-03-31 20:16:00")),
]

CHAT_ROOMS = [
    {"slug": "hc-hist",  "msgs": [("first-msg", "Alice"), ("second-msg", "Bob")]},
    {"slug": "hc-limit", "msgs": [(f"msg{i}", "u") for i in range(20)]},   # health-check: limit test needs 20
    {"slug": "hc-iso-a", "msgs": [("secret-a", "Alice"), ("hello-a", "Alice")]},
    {"slug": "hc-iso-b", "msgs": []},
    {"slug": "hc-order", "msgs": [("alpha", "u"), ("beta", "u"), ("gamma", "u")]},  # health-check: order test needs 3
]


async def seed():
    engine = create_async_engine(DATABASE_URL, echo=False)
    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with Session() as session:
        # ── insert credentials first (users.credential_id is NOT NULL) ─
        cred_ids = {}
        for u in USERS:
            existing = await session.execute(
                text("SELECT id FROM credentials WHERE username = :u"), {"u": u["username"]}
            )
            row = existing.fetchone()
            if row:
                cred_ids[u["username"]] = row[0]
                print(f"  [skip] credentials '{u['username']}' already exist")
                continue

            pw_hash = _hash(PASSWORD)
            result = await session.execute(
                text("INSERT INTO credentials (username, password) VALUES (:u, :p) RETURNING id"),
                {"u": u["username"], "p": pw_hash},
            )
            cred_ids[u["username"]] = result.fetchone()[0]
            print(f"  [ok]   credentials '{u['username']}' created (password='{PASSWORD}')")

        # ── insert users linked to their credential ───────────────────
        user_ids = {}
        for u in USERS:
            existing = await session.execute(
                text("SELECT id FROM users WHERE username = :u"), {"u": u["username"]}
            )
            row = existing.fetchone()
            if row:
                user_ids[u["username"]] = row[0]
                print(f"  [skip] user '{u['username']}' already exists (id={row[0]})")
                continue

            result = await session.execute(
                text("""
                    INSERT INTO users (username, display_name, status, bio, avatar_url, credential_id)
                    VALUES (:username, :display_name, :status, :bio, :avatar_url, :credential_id)
                    RETURNING id
                """),
                {**u, "credential_id": cred_ids[u["username"]]},
            )
            uid = result.fetchone()[0]
            user_ids[u["username"]] = uid
            print(f"  [ok]   user '{u['username']}' created (id={uid})")

        # ── insert friendships ────────────────────────────────────────
        for requester, addressee, status in FRIENDSHIPS:
            r_id = user_ids.get(requester)
            a_id = user_ids.get(addressee)
            if not r_id or not a_id:
                continue
            existing = await session.execute(
                text("""
                    SELECT id FROM friendships
                    WHERE (requester_id=:r AND addressee_id=:a)
                       OR (requester_id=:a AND addressee_id=:r)
                """),
                {"r": r_id, "a": a_id},
            )
            if existing.fetchone():
                print(f"  [skip] {requester} <-> {addressee} friendship already exists")
            else:
                await session.execute(
                    text("""
                        INSERT INTO friendships (requester_id, addressee_id, status)
                        VALUES (:r, :a, :status)
                    """),
                    {"r": r_id, "a": a_id, "status": status},
                )
                print(f"  [ok]   {requester} -> {addressee} → {status}")

        # ── insert matches ────────────────────────────────────────────
        for p1_name, p2_name, winner_name, s1, s2, started, finished in MATCHES:
            p1     = user_ids.get(p1_name)
            p2     = user_ids.get(p2_name)
            winner = user_ids.get(winner_name)
            if not p1 or not p2 or not winner:
                continue
            existing = await session.execute(
                text("""
                    SELECT id FROM matches
                    WHERE player1_id=:p1 AND player2_id=:p2 AND started_at=:s
                """),
                {"p1": p1, "p2": p2, "s": started},
            )
            if existing.fetchone():
                print(f"  [skip] match {started} already exists")
                continue

            await session.execute(
                text("""
                    INSERT INTO matches
                        (player1_id, player2_id, winner_id, score_p1, score_p2,
                         started_at, finished_at, status)
                    VALUES
                        (:p1, :p2, :winner, :s1, :s2,
                         :started, :finished, 'finished')
                """),
                {
                    "p1": p1, "p2": p2, "winner": winner,
                    "s1": s1, "s2": s2,
                    "started": started, "finished": finished,
                },
            )
            print(f"  [ok]   match {started} seeded ({p1_name} {s1}-{s2} {p2_name})")

        # ── seed chat rooms ───────────────────────────────────────────
        for room in CHAT_ROOMS:
            existing = await session.execute(
                text("SELECT id FROM chat_rooms WHERE room_name = :slug"),
                {"slug": room["slug"]},
            )
            row = existing.fetchone()
            if row:
                room_id = row[0]
                if room["msgs"]:
                    count_row = await session.execute(
                        text("SELECT COUNT(*) FROM messages WHERE room_id = :rid"),
                        {"rid": room_id},
                    )
                    if count_row.fetchone()[0] >= len(room["msgs"]):
                        print(f"  [skip] chat room '{room['slug']}' already seeded")
                        continue
                    for content, sender in room["msgs"]:
                        await session.execute(
                            text("INSERT INTO messages (room_id, content, sender_name) VALUES (:rid, :c, :s)"),
                            {"rid": room_id, "c": content, "s": sender},
                        )
                    print(f"  [fix]  chat room '{room['slug']}' messages re-seeded ({len(room['msgs'])} messages)")
                else:
                    print(f"  [skip] chat room '{room['slug']}' already exists (empty room)")
                continue

            result = await session.execute(
                text("INSERT INTO chat_rooms (room_name) VALUES (:slug) RETURNING id"),
                {"slug": room["slug"]},
            )
            room_id = result.fetchone()[0]
            for content, sender in room["msgs"]:
                await session.execute(
                    text("INSERT INTO messages (room_id, content, sender_name) VALUES (:rid, :c, :s)"),
                    {"rid": room_id, "c": content, "s": sender},
                )
            print(f"  [ok]   chat room '{room['slug']}' seeded ({len(room['msgs'])} messages)")

        await session.commit()

    await engine.dispose()
    print("\nDone. Login at https://localhost:8443 with any of the accounts above.")
    print(f"  Password for all accounts: '{PASSWORD}'")


if __name__ == "__main__":
    asyncio.run(seed())
