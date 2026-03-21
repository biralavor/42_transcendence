#!/usr/bin/env python3
"""
Dev seed script — fills users, credentials, friendships, matches, and chat rooms.

Usage (from repo root):
    make seed

Or manually:
    docker compose cp tests/seed_dev.py user-service:/app/seed_dev.py
    docker compose exec user-service python3 /app/seed_dev.py

Test accounts created:
    username: alice   password: test123   id: (auto)
    username: bob     password: test123   id: (auto)
    username: charlie password: test123   id: (auto)

Friendships seeded:
    alice  <-> bob     → accepted  (alice can see bob in friends list)
    charlie -> alice   → pending   (alice sees charlie in pending requests)

Chat rooms seeded (fixed slugs used by TranscendenceHealthCheck.sh):
    hc-hist   → 2 messages: first-msg (Alice), second-msg (Bob)
    hc-limit  → 60 messages msg0…msg59
    hc-iso-a  → 1 message: secret-a (Alice)
    hc-iso-b  → empty room (isolation test counterpart)
    hc-order  → 3 messages: alpha, beta, gamma
"""

import os
import sys
import bcrypt

# ── make sure shared + service are importable ───────────────────────
_here = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(_here, "src", "backend"))          # host path
sys.path.insert(0, "/app")                                          # container path
sys.path.insert(0, "/app/service")                                  # container path

import asyncio
from datetime import datetime
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

# ── DB URL (same env var used by all services) ───────────────────────
DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+asyncpg://transcendence_user:change_me@db:5432/transcendence_db",
)


def _hash(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


USERS = [
    dict(username="alice",   display_name="Alice",   status="online",  bio="Hi, I'm Alice!",   avatar_url=None),
    dict(username="bob",     display_name="Bob",     status="offline", bio="Bob here.",         avatar_url=None),
    dict(username="charlie", display_name="Charlie", status="online",  bio="Charlie checking in.", avatar_url=None),
]

PASSWORD = "test123"


async def seed():
    engine = create_async_engine(DATABASE_URL, echo=False)
    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with Session() as session:
        # ── insert users ─────────────────────────────────────────────
        user_ids = {}
        for u in USERS:
            # upsert: skip if username already exists
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
                    INSERT INTO users (username, display_name, status, bio, avatar_url)
                    VALUES (:username, :display_name, :status, :bio, :avatar_url)
                    RETURNING id
                """),
                u,
            )
            uid = result.fetchone()[0]
            user_ids[u["username"]] = uid
            print(f"  [ok]   user '{u['username']}' created (id={uid})")

        # ── insert credentials ────────────────────────────────────────
        for u in USERS:
            existing = await session.execute(
                text("SELECT id FROM credentials WHERE username = :u"), {"u": u["username"]}
            )
            if existing.fetchone():
                print(f"  [skip] credentials '{u['username']}' already exist")
                continue

            pw_hash = _hash(PASSWORD)
            await session.execute(
                text("INSERT INTO credentials (username, password) VALUES (:u, :p)"),
                {"u": u["username"], "p": pw_hash},
            )
            print(f"  [ok]   credentials '{u['username']}' created (password='{PASSWORD}')")

        # ── insert friendships ────────────────────────────────────────
        alice_id   = user_ids.get("alice")
        bob_id     = user_ids.get("bob")
        charlie_id = user_ids.get("charlie")

        if alice_id and bob_id:
            existing = await session.execute(
                text("""
                    SELECT id FROM friendships
                    WHERE (requester_id=:a AND addressee_id=:b)
                       OR (requester_id=:b AND addressee_id=:a)
                """),
                {"a": alice_id, "b": bob_id},
            )
            if existing.fetchone():
                print(f"  [skip] alice <-> bob friendship already exists")
            else:
                await session.execute(
                    text("""
                        INSERT INTO friendships (requester_id, addressee_id, status)
                        VALUES (:r, :a, 'accepted')
                    """),
                    {"r": alice_id, "a": bob_id},
                )
                print(f"  [ok]   alice <-> bob → accepted")

        if charlie_id and alice_id:
            existing = await session.execute(
                text("""
                    SELECT id FROM friendships
                    WHERE (requester_id=:c AND addressee_id=:a)
                       OR (requester_id=:a AND addressee_id=:c)
                """),
                {"c": charlie_id, "a": alice_id},
            )
            if existing.fetchone():
                print(f"  [skip] charlie -> alice friendship already exists")
            else:
                await session.execute(
                    text("""
                        INSERT INTO friendships (requester_id, addressee_id, status)
                        VALUES (:r, :a, 'pending')
                    """),
                    {"r": charlie_id, "a": alice_id},
                )
                print(f"  [ok]   charlie -> alice → pending")

        # ── insert matches ────────────────────────────────────────────
        def dt(s):
            return datetime.strptime(s, "%Y-%m-%d %H:%M:%S")

        MATCHES = [
            # alice beat bob 11-7
            dict(p1=alice_id,   p2=bob_id,     winner=alice_id,   s1=11, s2=7,
                 started=dt("2026-03-14 20:00:00"), finished=dt("2026-03-14 20:12:00")),
            # bob beat alice 11-9
            dict(p1=bob_id,     p2=alice_id,   winner=bob_id,     s1=11, s2=9,
                 started=dt("2026-03-15 18:30:00"), finished=dt("2026-03-15 18:45:00")),
            # alice beat charlie 11-4
            dict(p1=alice_id,   p2=charlie_id, winner=alice_id,   s1=11, s2=4,
                 started=dt("2026-03-16 21:00:00"), finished=dt("2026-03-16 21:10:00")),
            # charlie beat bob 11-8
            dict(p1=charlie_id, p2=bob_id,     winner=charlie_id, s1=11, s2=8,
                 started=dt("2026-03-17 19:00:00"), finished=dt("2026-03-17 19:13:00")),
            # alice beat bob 11-6 (rematch)
            dict(p1=alice_id,   p2=bob_id,     winner=alice_id,   s1=11, s2=6,
                 started=dt("2026-03-18 20:00:00"), finished=dt("2026-03-18 20:11:00")),
        ]

        for m in MATCHES:
            if not m["p1"] or not m["p2"]:
                continue
            existing = await session.execute(
                text("""
                    SELECT id FROM matches
                    WHERE player1_id=:p1 AND player2_id=:p2 AND started_at=:s
                """),
                {"p1": m["p1"], "p2": m["p2"], "s": m["started"]},
            )
            if existing.fetchone():
                print(f"  [skip] match {m['started']} already exists")
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
                    "p1": m["p1"], "p2": m["p2"], "winner": m["winner"],
                    "s1": m["s1"], "s2": m["s2"],
                    "started": m["started"], "finished": m["finished"],
                },
            )
            print(f"  [ok]   match {m['started']} seeded ({m['s1']}-{m['s2']})")

        # ── seed chat rooms ───────────────────────────────────────────
        CHAT_ROOMS = [
            {"slug": "hc-hist",  "msgs": [("first-msg", "Alice"), ("second-msg", "Bob")]},
            {"slug": "hc-limit", "msgs": [(f"msg{i}", "u") for i in range(60)]},
            {"slug": "hc-iso-a", "msgs": [("secret-a", "Alice")]},
            {"slug": "hc-iso-b", "msgs": []},
            {"slug": "hc-order", "msgs": [("alpha", "u"), ("beta", "u"), ("gamma", "u")]},
        ]

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
                    # Room exists but messages are missing — insert them
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
    print(f"  Credentials table is separate from users — login uses 'credentials'.")


if __name__ == "__main__":
    asyncio.run(seed())
