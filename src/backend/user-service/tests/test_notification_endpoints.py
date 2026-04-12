# src/backend/user-service/tests/test_notification_endpoints.py
"""Integration tests for notification endpoints with message length validation."""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from httpx import AsyncClient

from main import app
from service.notifications import MAX_NOTIFICATION_MESSAGE_LENGTH
from service.models.user import User


@pytest.fixture
def mock_user():
    """Mock authenticated user."""
    user = MagicMock(spec=User)
    user.id = 1
    user.username = "alice"
    return user


@pytest.mark.asyncio
async def test_deliver_game_notification_message_too_long(mock_user):
    """POST /game-invites returns 400 if message would exceed length limit."""
    client = AsyncClient(app=app, base_url="http://test")
    
    # Patch get_current_user to return mock_user
    with patch("main.get_current_user", return_value=mock_user):
        # Patch notification creation to simulate a very long message
        with patch("main._notifications.create_notification") as mock_create:
            mock_create.side_effect = ValueError(
                f"Notification message must be 1-{MAX_NOTIFICATION_MESSAGE_LENGTH} characters (got 500 characters)"
            )
            
            response = await client.post(
                "/game-invites",
                json={
                    "type": "game_invite",
                    "to_user_id": 2,
                    "room_id": "invite-1-2-123",
                }
            )
            
            # Should return 400 Bad Request
            assert response.status_code == 400
            assert "message must be 1" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_deliver_game_notification_typical_message(mock_user):
    """POST /game-invites succeeds with typical message lengths."""
    client = AsyncClient(app=app, base_url="http://test")
    
    # Patch get_current_user and dependencies
    with patch("main.get_current_user", return_value=mock_user):
        with patch("main._notifications.create_notification") as mock_create:
            # Mock successful notification creation
            mock_notif = MagicMock()
            mock_notif.id = 1
            mock_notif.user_id = 2
            mock_notif.type = "game_invite"
            mock_notif.message = "alice invited you to play Pong"
            mock_notif.read = False
            mock_create.return_value = mock_notif
            
            with patch("main.notification_manager.broadcast"):
                response = await client.post(
                    "/game-invites",
                    json={
                        "type": "game_invite",
                        "to_user_id": 2,
                        "room_id": "invite-1-2-123",
                    }
                )
                
                # Should succeed (204 No Content)
                assert response.status_code == 204


@pytest.mark.asyncio
async def test_add_friend_notification_validation_failure_doesnt_fail_request(mock_user):
    """POST /friends/request/{addressee_id} succeeds even if notification creation fails."""
    client = AsyncClient(app=app, base_url="http://test")
    
    # Mock friendship creation
    mock_friendship = MagicMock()
    mock_friendship.id = 1
    mock_friendship.requester_id = 1
    mock_friendship.addressee_id = 2
    mock_friendship.status = "pending"
    
    with patch("main.get_current_user", return_value=mock_user):
        with patch("main._friends.send_friend_request", return_value=mock_friendship):
            # Patch notification creation to fail
            with patch("main._notifications.create_notification") as mock_create:
                mock_create.side_effect = ValueError(
                    f"Notification message must be 1-{MAX_NOTIFICATION_MESSAGE_LENGTH} characters"
                )
                
                response = await client.post("/friends/request/2")
                
                # Should still return 201 (friendship created)
                # The notification error is logged but doesn't fail the request
                assert response.status_code == 201


@pytest.mark.asyncio
async def test_respond_to_friend_request_notification_validation_failure(mock_user):
    """PUT /friends/requests/{request_id} handles notification validation errors gracefully."""
    client = AsyncClient(app=app, base_url="http://test")
    
    # Mock friend request acceptance
    mock_result = MagicMock()
    mock_result.id = 1
    mock_result.requester_id = 2
    mock_result.addressee_id = 1
    mock_result.status = "accepted"
    
    with patch("main.get_current_user", return_value=mock_user):
        with patch("main._friends.respond_to_friend_request", return_value=mock_result):
            # Patch notification creation to fail
            with patch("main._notifications.create_notification") as mock_create:
                mock_create.side_effect = ValueError(
                    f"Notification message must be 1-{MAX_NOTIFICATION_MESSAGE_LENGTH} characters"
                )
                
                response = await client.put(
                    "/friends/requests/1",
                    json={"action": "accept"}
                )
                
                # Should still return 200 (request accepted)
                # The notification error is logged but doesn't fail the request
                assert response.status_code == 200


class TestNotificationMessageLengthValidation:
    """Test notification message length validation across the stack."""

    def test_max_notification_message_length_is_256(self):
        """Verify constant is set correctly."""
        assert MAX_NOTIFICATION_MESSAGE_LENGTH == 256

    def test_game_invite_messages_fit_in_limit(self):
        """Verify game invite messages fit within limit."""
        messages = [
            "alice invited you to play Pong",
            "alice accepted your game invite",
            "alice declined your game invite",
            "Your game invite with alice has expired",
        ]
        for msg in messages:
            assert len(msg) <= MAX_NOTIFICATION_MESSAGE_LENGTH

    def test_friend_request_messages_fit_in_limit(self):
        """Verify friend request messages fit within limit."""
        messages = [
            "alice sent you a friend request",
            "alice accepted your friend request",
        ]
        for msg in messages:
            assert len(msg) <= MAX_NOTIFICATION_MESSAGE_LENGTH

    def test_message_with_very_long_username_fits(self):
        """Verify message with maximum username length still fits."""
        max_username_len = 50  # Typical max for usernames
        long_username = "a" * max_username_len
        
        # Worst case messages
        messages = [
            f"{long_username} invited you to play Pong",
            f"{long_username} sent you a friend request",
            f"Your game invite with {long_username} has expired",
        ]
        
        for msg in messages:
            assert len(msg) <= MAX_NOTIFICATION_MESSAGE_LENGTH, \
                f"Message with long username exceeds limit: {len(msg)} > {MAX_NOTIFICATION_MESSAGE_LENGTH}"

    def test_message_at_exactly_256_characters(self):
        """Verify message at exactly 256 characters is accepted."""
        from service.models.notification import Notification
        
        msg_256 = "x" * 256
        notif = Notification(user_id=1, type="friend_request", message=msg_256, read=False)
        assert notif.message == msg_256
        assert len(notif.message) == 256
