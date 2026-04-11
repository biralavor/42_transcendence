# src/backend/user-service/tests/test_schemas.py
"""Tests for schema validation, particularly notification types."""
import pytest
from datetime import datetime
from pydantic import ValidationError

from schemas import (
    NotificationResponse,
    GameNotificationRequest,
    NOTIFICATION_TYPES,
)


class TestNotificationTypes:
    """Test that NOTIFICATION_TYPES constant is properly defined."""

    def test_notification_types_defined(self):
        """Verify all expected notification types are in the whitelist."""
        expected_types = {
            "friend_request",
            "friend_request_accepted",
            "friend_request_declined",
            "game_invite",
            "game_invite_response",
            "game_invite_timeout",
            "unread_chat",
            "match_result",
        }
        # NOTIFICATION_TYPES is a Literal, so __args__ contains the values
        actual_types = set(NOTIFICATION_TYPES.__args__)
        assert actual_types == expected_types, f"Mismatch: {actual_types} vs {expected_types}"


class TestNotificationResponseValidation:
    """Test NotificationResponse schema validation."""

    def test_notification_response_valid_type_game_invite(self):
        """Valid notification with game_invite type."""
        notif = NotificationResponse(
            id=1,
            user_id=2,
            type="game_invite",
            message="You have a game invite",
            read=False,
            created_at=datetime.now(),
        )
        assert notif.type == "game_invite"
        assert notif.read is False

    def test_notification_response_valid_type_friend_request(self):
        """Valid notification with friend_request type."""
        notif = NotificationResponse(
            id=2,
            user_id=3,
            type="friend_request",
            message="Alice sent you a friend request",
            read=False,
            created_at=datetime.now(),
        )
        assert notif.type == "friend_request"

    def test_notification_response_valid_type_unread_chat(self):
        """Valid notification with unread_chat type."""
        notif = NotificationResponse(
            id=3,
            user_id=4,
            type="unread_chat",
            message="2 unread messages from Bob",
            read=True,
            created_at=datetime.now(),
        )
        assert notif.type == "unread_chat"
        assert notif.read is True

    def test_notification_response_rejects_invalid_type(self):
        """Invalid notification type should raise ValidationError."""
        with pytest.raises(ValidationError) as exc_info:
            NotificationResponse(
                id=1,
                user_id=2,
                type="invalid_notification_type",
                message="This should fail",
                read=False,
                created_at=datetime.now(),
            )
        assert "type" in str(exc_info.value).lower()

    def test_notification_response_rejects_typo_type(self):
        """Close misspellings should still be rejected."""
        with pytest.raises(ValidationError):
            NotificationResponse(
                id=1,
                user_id=2,
                type="game_invites",  # typo: plural 's'
                message="Typo should fail",
                read=False,
                created_at=datetime.now(),
            )

    def test_notification_response_rejects_empty_type(self):
        """Empty type should be rejected."""
        with pytest.raises(ValidationError):
            NotificationResponse(
                id=1,
                user_id=2,
                type="",
                message="Empty type",
                read=False,
                created_at=datetime.now(),
            )

    def test_notification_response_all_valid_types(self):
        """All types in NOTIFICATION_TYPES should be accepted."""
        valid_types = NOTIFICATION_TYPES.__args__
        for notif_type in valid_types:
            notif = NotificationResponse(
                id=1,
                user_id=2,
                type=notif_type,
                message=f"Test notification of type {notif_type}",
                read=False,
                created_at=datetime.now(),
            )
            assert notif.type == notif_type


class TestGameNotificationRequestValidation:
    """Test GameNotificationRequest schema validation."""

    def test_game_invite_valid(self):
        """Valid game_invite notification."""
        req = GameNotificationRequest(
            type="game_invite",
            to_user_id=5,
            room_id="invite-1-5-1234567890",
            to_username="alice",
            expires_at=1234567890,
        )
        assert req.type == "game_invite"
        assert req.to_user_id == 5

    def test_game_invite_response_accepted(self):
        """Valid game_invite_response with accepted status."""
        req = GameNotificationRequest(
            type="game_invite_response",
            to_user_id=10,
            room_id="invite-1-10-1234567890",
            status="accepted",
        )
        assert req.type == "game_invite_response"
        assert req.status == "accepted"

    def test_game_invite_response_declined(self):
        """Valid game_invite_response with declined status."""
        req = GameNotificationRequest(
            type="game_invite_response",
            to_user_id=10,
            room_id="invite-1-10-1234567890",
            status="declined",
        )
        assert req.status == "declined"

    def test_game_invite_response_timeout(self):
        """Valid game_invite_response with timeout status."""
        req = GameNotificationRequest(
            type="game_invite_timeout",
            to_user_id=10,
            room_id="invite-1-10-1234567890",
        )
        assert req.type == "game_invite_timeout"

    def test_game_notification_rejects_non_game_type(self):
        """GameNotificationRequest should only accept game-related types."""
        with pytest.raises(ValidationError):
            GameNotificationRequest(
                type="friend_request",  # Not a game type
                to_user_id=5,
                room_id="some-room",
            )

    def test_game_notification_rejects_zero_to_user_id(self):
        """to_user_id must be positive (not 0)."""
        with pytest.raises(ValidationError) as exc_info:
            GameNotificationRequest(
                type="game_invite",
                to_user_id=0,
                room_id="invite-1-0-1234567890",
            )
        assert "positive integer" in str(exc_info.value).lower()

    def test_game_notification_rejects_negative_to_user_id(self):
        """to_user_id must be positive (not negative)."""
        with pytest.raises(ValidationError) as exc_info:
            GameNotificationRequest(
                type="game_invite",
                to_user_id=-5,
                room_id="invite-1-5-1234567890",
            )
        assert "positive integer" in str(exc_info.value).lower()

    def test_game_notification_accepts_positive_to_user_id(self):
        """to_user_id must accept any positive integer."""
        for user_id in [1, 42, 999, 999999]:
            req = GameNotificationRequest(
                type="game_invite",
                to_user_id=user_id,
                room_id=f"invite-1-{user_id}-1234567890",
            )
            assert req.to_user_id == user_id

    def test_game_notification_status_accepts_valid_values(self):
        """status field accepts only valid values when provided."""
        for status in ["accepted", "declined", "timeout"]:
            req = GameNotificationRequest(
                type="game_invite_response",
                to_user_id=5,
                room_id="invite-1-5-1234567890",
                status=status,
            )
            assert req.status == status

    def test_game_notification_status_rejects_invalid_values(self):
        """status field rejects invalid values."""
        with pytest.raises(ValidationError):
            GameNotificationRequest(
                type="game_invite_response",
                to_user_id=5,
                room_id="invite-1-5-1234567890",
                status="pending",  # Invalid, should be accepted/declined/timeout
            )

    def test_game_notification_optional_fields(self):
        """Optional fields like to_username can be omitted."""
        req = GameNotificationRequest(
            type="game_invite",
            to_user_id=5,
            room_id="invite-1-5-1234567890",
            # to_username, from_avatar_url, expires_at all omitted
        )
        assert req.to_username is None
        assert req.from_avatar_url is None
        assert req.expires_at is None
