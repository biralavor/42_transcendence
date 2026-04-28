"""End-to-end: anonymous visitor lists live games and joining as spectator
bumps the spectator_count exposed by GET /api/games/live.

This test runs against the live docker stack (nginx terminating TLS) and uses
the same `api` fixture/helpers as the rest of tests/api_e2e/.

Notes on what makes a match appear in /api/games/live:
- The endpoint applies an "Option B" filter: only matches whose game_id is
  bound in the in-memory `_match_id_to_game_id` reverse map are listed.
- That binding happens when `_ensure_game_session()` is called with an
  `existing_match_id` — which the WS handler does once both players have
  sent `player_ready` and the waiting-room handshake completes.
- So this test drives the full waiting-room handshake (connect → player_ready
  → game_start) before connecting the anonymous spectator.
"""
import asyncio
import json
import secrets
import ssl

import pytest
import websockets

from conftest import register_user


def _ws_base_from_api(api) -> str:
    """Convert the api fixture's https://nginx base into wss://nginx."""
    base = str(api.base_url)
    if base.startswith("https://"):
        return "wss://" + base[len("https://"):]
    if base.startswith("http://"):
        return "ws://" + base[len("http://"):]
    return base


def _insecure_ssl_ctx() -> ssl.SSLContext:
    """Self-signed certs in dev → disable verification (matches HTTPX_KWARGS)."""
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx


async def _drain_until(ws, predicate, *, timeout: float = 3.0):
    """Receive frames until `predicate(frame_dict)` returns True or we time out.

    Returns the matching frame, or None on timeout. Non-matching frames are
    discarded silently.
    """
    deadline = asyncio.get_event_loop().time() + timeout
    while True:
        remaining = deadline - asyncio.get_event_loop().time()
        if remaining <= 0:
            return None
        try:
            raw = await asyncio.wait_for(ws.recv(), timeout=remaining)
        except asyncio.TimeoutError:
            return None
        try:
            frame = json.loads(raw)
        except (TypeError, ValueError):
            continue
        if predicate(frame):
            return frame


@pytest.mark.asyncio
async def test_anonymous_visitor_can_list_live_games(api):
    """No Authorization header -> 200 + a JSON array (possibly empty)."""
    resp = await api.get("/api/games/live")
    assert resp.status_code == 200, f"{resp.status_code} {resp.text[:200]}"
    body = resp.json()
    assert isinstance(body, list)
    for entry in body:
        assert {"game_id", "player1", "player2", "started_at", "spectator_count"} <= entry.keys()
        assert isinstance(entry["spectator_count"], int)
        assert entry["spectator_count"] >= 0


@pytest.mark.asyncio
async def test_spectator_count_increments_on_anonymous_ws_join(api):
    """Two players create a match, both run the waiting-room ready handshake
    so the in-memory `_match_id_to_game_id` reverse map gets populated, then
    an anonymous spectator opens a WS to that room.

    GET /api/games/live should then list the match with spectator_count >= 1,
    and the spectator should be force-closed with code 4003 if it sends an
    input message.
    """
    # 1. Register two players and create an ongoing match between them.
    alice = await register_user(api)
    bob = await register_user(api)
    create = await api.post("/api/game/matches", json={
        "player1_id": alice["user_id"],
        "player2_id": bob["user_id"],
    })
    assert create.status_code == 201, f"match create: {create.status_code} {create.text[:200]}"
    match_id = create.json()["id"]

    ssl_ctx = _insecure_ssl_ctx()
    ws_base = _ws_base_from_api(api)
    # game_id used on the WS path. Mirror the production frontend's
    # "invite-{p1}-{p2}-{nonce}" convention so the server's invite-URL parser
    # can seed _waiting_room_players on the very first connect (post-Task 7
    # the role classifier runs BEFORE _ensure_waiting_room_players is called
    # explicitly, so the parser fallback in _resolve_room_player_ids matters).
    nonce = secrets.token_hex(4)
    game_id = f"invite-{alice['user_id']}-{bob['user_id']}-{nonce}"

    def player_url(token: str) -> str:
        return f"{ws_base}/api/game/ws/game/{game_id}?token={token}"

    anon_url = f"{ws_base}/api/game/ws/game/{game_id}"

    # 2. Connect both players, drive the waiting-room ready handshake so the
    #    server calls _ensure_game_session(..., existing_match_id=match_id),
    #    which calls _bind_match(game_id, match_id) — required for the match
    #    to show up in GET /games/live (Option B filter).
    async with websockets.connect(player_url(alice["token"]), ssl=ssl_ctx) as p1, \
               websockets.connect(player_url(bob["token"]),   ssl=ssl_ctx) as p2:
        # Drain the initial waiting_room_status frames.
        await _drain_until(p1, lambda f: f.get("type") == "waiting_room_status", timeout=2.0)
        await _drain_until(p2, lambda f: f.get("type") == "waiting_room_status", timeout=2.0)

        # Both players send player_ready (with match_id so it gets bound even
        # if _setup_sessions wasn't pre-seeded — see _ensure_game_session).
        ready_p1 = {
            "type": "player_ready",
            "user_id": alice["user_id"],
            "player1_id": alice["user_id"],
            "player2_id": bob["user_id"],
            "match_id": match_id,
        }
        ready_p2 = {
            "type": "player_ready",
            "user_id": bob["user_id"],
            "player1_id": alice["user_id"],
            "player2_id": bob["user_id"],
            "match_id": match_id,
        }
        await p1.send(json.dumps(ready_p1))
        await p2.send(json.dumps(ready_p2))

        # Wait until the server broadcasts game_start on either socket — that
        # confirms _ensure_game_session has run and the match is bound.
        gs1 = _drain_until(p1, lambda f: f.get("type") == "game_start", timeout=5.0)
        gs2 = _drain_until(p2, lambda f: f.get("type") == "game_start", timeout=5.0)
        game_start_frames = await asyncio.gather(gs1, gs2)
        assert any(f is not None for f in game_start_frames), (
            f"never received game_start on either socket; frames={game_start_frames}"
        )

        # 3. Anonymous spectator joins the same room (no token).
        async with websockets.connect(anon_url, ssl=ssl_ctx) as spec:
            # Allow the count broadcast to round-trip and the manager to
            # register the spectator role before we hit the HTTP endpoint.
            await asyncio.sleep(0.5)

            # 4. GET /api/games/live → match listed with spectator_count >= 1.
            resp = await api.get("/api/games/live")
            assert resp.status_code == 200, resp.text[:200]
            entries = resp.json()
            ours = next((e for e in entries if e["game_id"] == game_id), None)
            assert ours is not None, (
                f"game_id {game_id} (match {match_id}) not in /games/live. "
                f"Entries: {[e['game_id'] for e in entries]}"
            )
            assert ours["spectator_count"] >= 1, (
                f"expected spectator_count >= 1, got {ours['spectator_count']}"
            )
            assert ours["player1"]["id"] == alice["user_id"]
            assert ours["player2"]["id"] == bob["user_id"]

            # 5. Spectator misuse: any input message → server closes with 4003.
            await spec.send(json.dumps({"type": "input", "direction": "up"}))
            with pytest.raises(websockets.exceptions.ConnectionClosed) as exc_info:
                # Drain any frames the server may have sent before closing
                # (e.g. spectator_count); eventually recv() raises.
                while True:
                    await asyncio.wait_for(spec.recv(), timeout=2.0)
            assert exc_info.value.code == 4003, (
                f"expected close code 4003, got {exc_info.value.code}"
            )
