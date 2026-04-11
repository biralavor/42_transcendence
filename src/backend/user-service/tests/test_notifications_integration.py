import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from httpx import AsyncClient, ASGITransport
from service.main import app, get_current_user
from service.models.user import User

@pytest.mark.asyncio
async def test_add_friend_broadcasts_notification():
    """Verify that adding a friend triggers a WebSocket notification broadcast."""
    
    # Mock data
    user_id = 1
    addressee_id = 2
    
    mock_user = User(id=user_id, username="alice")
    mock_notif = MagicMock()
    mock_notif.id = 101
    mock_notif.type = "friend_request"
    mock_notif.message = "alice sent you a friend request"
    mock_notif.read = False
    mock_notif.created_at = None 
    
    # Complete mock for FriendRequestResponse validation
    mock_friendship = MagicMock()
    mock_friendship.id = 500
    mock_friendship.requester_id = user_id
    mock_friendship.addressee_id = addressee_id
    mock_friendship.status = "pending"
    mock_friendship.requester_username = "alice"
    mock_friendship.addressee_username = "bob"
    
    app.dependency_overrides[get_current_user] = lambda: mock_user
    
    try:
        # Patch where it was DEFINED, not where it was IMPORTED if simple import was used.
        # However, main.py does: from service.ws.notification_router import ..., notification_manager
        # So we must patch it in service.ws.notification_router.
        with patch("service.main._friends.send_friend_request", return_value=mock_friendship), \
             patch("service.main._notifications.create_notification", return_value=mock_notif), \
             patch("service.ws.notification_router.notification_manager.broadcast", new_callable=AsyncMock) as mock_broadcast:
            
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                resp = await client.post(
                    f"/friends/request/{addressee_id}",
                    headers={"Authorization": "Bearer fake-token"}
                )
                
                assert resp.status_code == 201
                
                # Check if broadcast was called
                mock_broadcast.assert_called_once()
                args, kwargs = mock_broadcast.call_args
                assert args[0] == str(addressee_id)
                assert args[1]["type"] == "notification"
    finally:
        app.dependency_overrides.clear()

@pytest.mark.asyncio
async def test_game_invite_broadcasts_and_notifies():
    """Verify that sending a game invite triggers both a direct payload and a notification."""
    
    user_id = 1
    target_id = 7
    mock_user = User(id=user_id, username="alice")
    
    mock_notif = MagicMock()
    mock_notif.id = 202
    mock_notif.type = "game_invite"
    mock_notif.message = "alice invited you to play Pong"
    mock_notif.read = False
    mock_notif.created_at = None
    
    app.dependency_overrides[get_current_user] = lambda: mock_user
    
    try:
        with patch("service.main._notifications.create_notification", return_value=mock_notif), \
             patch("service.ws.notification_router.notification_manager.broadcast", new_callable=AsyncMock) as mock_broadcast:
            
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                resp = await client.post(
                    "/game-invites",
                    json={
                        "type": "game_invite",
                        "to_user_id": target_id,
                        "room_id": "r1",
                    },
                    headers={"Authorization": "Bearer fake-token"}
                )
                
                assert resp.status_code == 204
                assert mock_broadcast.call_count == 2
    finally:
        app.dependency_overrides.clear()
