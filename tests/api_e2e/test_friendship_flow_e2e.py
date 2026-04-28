"""End-to-end test of friendship + cross-user notification flow.

Drives:
  1. Register two fresh users (alice, bob)
  2. Alice sends a friend request to Bob
  3. Bob's GET /notifications shows a `friend_request` from Alice
  4. Bob's GET /friends/me/requests shows Alice's pending request
  5. Bob accepts via PUT /friends/requests/{id}
  6. Alice's GET /notifications shows a `friend_request_accepted` from Bob
  7. Both /friends/me endpoints show the other user

Catches: friendship FK violations, notification write side-effect skip,
PUT-action handler regressions, JSON shape drift on FriendResponse.
"""
import pytest
from conftest import register_user, auth_headers


@pytest.mark.asyncio
async def test_friendship_request_accept_flow(api):
    alice = await register_user(api)
    bob = await register_user(api)
    assert alice["user_id"] != bob["user_id"]

    req = await api.post(
        f"/api/users/friends/request/{bob['user_id']}",
        headers=auth_headers(alice["token"]),
    )
    assert req.status_code == 201, f"friend request failed: {req.status_code} {req.text[:200]}"
    request_id = req.json()["id"]

    pending = await api.get(
        "/api/users/friends/me/requests",
        headers=auth_headers(bob["token"]),
    )
    assert pending.status_code == 200
    assert any(r["id"] == request_id for r in pending.json()), (
        f"alice's request {request_id} should be in bob's pending list"
    )

    bob_notifs = await api.get(
        "/api/users/notifications",
        headers=auth_headers(bob["token"]),
    )
    assert bob_notifs.status_code == 200
    friend_req_notif = next(
        (n for n in bob_notifs.json() if n["type"] == "friend_request"), None,
    )
    assert friend_req_notif is not None, (
        "bob should have a friend_request notification — none found in "
        f"{[n['type'] for n in bob_notifs.json()][:5]}"
    )

    accept = await api.put(
        f"/api/users/friends/requests/{request_id}",
        json={"action": "accept"},
        headers=auth_headers(bob["token"]),
    )
    assert accept.status_code == 200, f"accept failed: {accept.status_code} {accept.text[:200]}"

    alice_notifs = await api.get(
        "/api/users/notifications",
        headers=auth_headers(alice["token"]),
    )
    assert alice_notifs.status_code == 200
    accepted_notif = next(
        (n for n in alice_notifs.json() if n["type"] == "friend_request_accepted"), None,
    )
    assert accepted_notif is not None, (
        "alice should have a friend_request_accepted notification"
    )

    alice_friends = await api.get(
        "/api/users/friends/me", headers=auth_headers(alice["token"]),
    )
    bob_friends = await api.get(
        "/api/users/friends/me", headers=auth_headers(bob["token"]),
    )
    assert alice_friends.status_code == 200 and bob_friends.status_code == 200
    alice_friend_ids = [f["id"] for f in alice_friends.json()]
    bob_friend_ids = [f["id"] for f in bob_friends.json()]
    assert bob["user_id"] in alice_friend_ids, "alice should see bob as a friend"
    assert alice["user_id"] in bob_friend_ids, "bob should see alice as a friend"


@pytest.mark.asyncio
async def test_friendship_request_decline_does_not_create_friendship(api):
    """Declining a request must NOT create a mutual friendship row.

    Regression guard for the past bug where decline accidentally went through
    the same accept-path that committed the friendship.
    """
    alice = await register_user(api)
    bob = await register_user(api)

    req = await api.post(
        f"/api/users/friends/request/{bob['user_id']}",
        headers=auth_headers(alice["token"]),
    )
    assert req.status_code == 201
    request_id = req.json()["id"]

    decline = await api.put(
        f"/api/users/friends/requests/{request_id}",
        json={"action": "decline"},
        headers=auth_headers(bob["token"]),
    )
    assert decline.status_code == 204, (
        f"decline should return 204, got {decline.status_code} {decline.text[:200]}"
    )

    alice_friends = await api.get(
        "/api/users/friends/me", headers=auth_headers(alice["token"]),
    )
    bob_friends = await api.get(
        "/api/users/friends/me", headers=auth_headers(bob["token"]),
    )
    assert alice_friends.status_code == 200 and bob_friends.status_code == 200
    assert bob["user_id"] not in [f["id"] for f in alice_friends.json()]
    assert alice["user_id"] not in [f["id"] for f in bob_friends.json()]
