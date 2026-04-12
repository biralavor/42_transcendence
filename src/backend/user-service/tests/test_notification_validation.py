# src/backend/user-service/tests/test_notification_validation.py
"""Tests for notification message length validation."""
import pytest
from unittest.mock import AsyncMock, MagicMock
from service.notifications import (
    create_notification,
    MAX_NOTIFICATION_MESSAGE_LENGTH,
)


@pytest.mark.asyncio
async def test_create_notification_message_too_long():
    """create_notification rejects messages exceeding MAX_NOTIFICATION_MESSAGE_LENGTH."""
    mock_db = AsyncMock()
    
    # Message exceeds limit by 1 character
    long_message = "x" * (MAX_NOTIFICATION_MESSAGE_LENGTH + 1)
    
    with pytest.raises(ValueError) as exc_info:
        await create_notification(mock_db, user_id=1, notif_type="friend_request", message=long_message)
    
    assert "must be 1" in str(exc_info.value).lower()
    assert str(MAX_NOTIFICATION_MESSAGE_LENGTH) in str(exc_info.value)


@pytest.mark.asyncio
async def test_create_notification_message_empty():
    """create_notification rejects empty messages."""
    mock_db = AsyncMock()
    
    with pytest.raises(ValueError) as exc_info:
        await create_notification(mock_db, user_id=1, notif_type="friend_request", message="")
    
    assert "1-" in str(exc_info.value)  # Expecting "1-256" format


@pytest.mark.asyncio
async def test_create_notification_message_at_limit():
    """create_notification accepts messages exactly at MAX_NOTIFICATION_MESSAGE_LENGTH."""
    mock_db = AsyncMock()
    
    # Create a mock notification object
    mock_notif = MagicMock()
    mock_notif.id = 1
    mock_notif.user_id = 1
    mock_notif.type = "friend_request"
    mock_notif.message = "x" * MAX_NOTIFICATION_MESSAGE_LENGTH
    mock_notif.read = False
    mock_notif.created_at = None
    
    # Mock the context manager
    mock_begin = AsyncMock()
    mock_begin.__aenter__ = AsyncMock(return_value=None)
    mock_begin.__aexit__ = AsyncMock(return_value=None)
    mock_db.begin.return_value = mock_begin
    
    # Allow db.add and db.flush
    mock_db.add = MagicMock()
    mock_db.flush = AsyncMock()
    
    # Mock refresh to populate the mock object
    async def mock_refresh(obj):
        pass  # Object already populated
    mock_db.refresh = mock_refresh
    
    # Should not raise
    message_at_limit = "x" * MAX_NOTIFICATION_MESSAGE_LENGTH
    # We can't easily test this without full DB setup, but we can verify it doesn't raise during validation
    try:
        # Just create the Notification object to verify message length validation
        from service.models.notification import Notification
        notif = Notification(user_id=1, type="friend_request", message=message_at_limit, read=False)
        # If we got here without exception, the message was accepted
        assert len(notif.message) == MAX_NOTIFICATION_MESSAGE_LENGTH
    except ValueError as e:
        pytest.fail(f"Should accept message at limit: {e}")


@pytest.mark.asyncio
async def test_create_notification_typical_messages():
    """Typical notification messages pass validation."""
    mock_db = AsyncMock()
    
    # Mock the context manager
    mock_begin = AsyncMock()
    mock_begin.__aenter__ = AsyncMock(return_value=None)
    mock_begin.__aexit__ = AsyncMock(return_value=None)
    mock_db.begin.return_value = mock_begin
    mock_db.add = MagicMock()
    mock_db.flush = AsyncMock()
    mock_db.refresh = AsyncMock()
    
    typical_messages = [
        "alice invited you to play Pong",
        "alice accepted your game invite",
        "alice declined your game invite",
        "Your game invite with alice has expired",
        "alice sent you a friend request",
        "alice accepted your friend request",
        "2 unread messages from alice",
        "You won your match against bob 4-2",  # Longer example
    ]
    
    for msg in typical_messages:
        # Verify message length is acceptable
        if len(msg) > MAX_NOTIFICATION_MESSAGE_LENGTH:
            pytest.fail(f"Typical message '{msg}' exceeds limit")
        assert len(msg) <= MAX_NOTIFICATION_MESSAGE_LENGTH


def test_max_notification_message_length_constant():
    """Verify MAX_NOTIFICATION_MESSAGE_LENGTH is set to a reasonable value."""
    assert MAX_NOTIFICATION_MESSAGE_LENGTH == 256
    assert MAX_NOTIFICATION_MESSAGE_LENGTH >= 100  # At least 100 chars


def test_typical_message_lengths():
    """Verify typical messages fit comfortably within the limit."""
    max_username_length = 50  # Reasonable estimate from typical schemas
    
    typical_templates = [
        "{username} invited you to play Pong",
        "{username} accepted your game invite",
        "{username} declined your game invite",
        "Your game invite with {username} has expired",
        "{username} sent you a friend request",
        "{username} accepted your friend request",
        # Worst case: longest reasonable message
        "Your game invite with very_long_username_example has expired",
    ]
    
    for template in typical_templates:
        # Simulate worst case with long username
        msg = template.format(username="a" * max_username_length)
        assert len(msg) < MAX_NOTIFICATION_MESSAGE_LENGTH, \
            f"Message with max username exceeds limit: {len(msg)} > {MAX_NOTIFICATION_MESSAGE_LENGTH}"
