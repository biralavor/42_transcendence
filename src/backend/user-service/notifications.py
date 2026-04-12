from fastapi import HTTPException
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from service.models.notification import Notification

# Validation constants
MAX_NOTIFICATION_MESSAGE_LENGTH = 256


async def get_notifications(db: AsyncSession, user_id: int) -> list[Notification]:
    """Return the last 20 notifications for user_id, newest first."""
    result = await db.execute(
        select(Notification)
        .where(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc(), Notification.id.desc())
        .limit(20)
    )
    return list(result.scalars().all())


async def mark_notification_read(
    db: AsyncSession, notification_id: int, user_id: int
) -> Notification:
    """Mark a single notification as read. Raises 404 if not found or not owned by user_id.
    
    Uses savepoint (nested transaction) for atomicity within the existing session transaction.
    """
    async with db.begin_nested():
        result = await db.execute(
            select(Notification).where(
                Notification.id == notification_id,
                Notification.user_id == user_id,
            )
        )
        notif = result.scalars().first()
        if notif is None:
            raise HTTPException(status_code=404, detail="Notification not found")
        notif.read = True
        await db.flush()
    return notif


async def mark_all_notifications_read(db: AsyncSession, user_id: int) -> None:
    """Mark all notifications for user_id as read.
    
    Uses savepoint (nested transaction) for atomicity within the existing session transaction.
    """
    async with db.begin_nested():
        await db.execute(
            update(Notification)
            .where(Notification.user_id == user_id, Notification.read.is_(False))
            .values(read=True)
        )


async def delete_notification(
    db: AsyncSession, notification_id: int, user_id: int
) -> None:
    """Delete a single notification. Raises 404 if not found or not owned by user_id.
    
    Uses savepoint (nested transaction) for atomicity within the existing session transaction.
    """
    async with db.begin_nested():
        result = await db.execute(
            select(Notification).where(
                Notification.id == notification_id,
                Notification.user_id == user_id,
            )
        )
        notif = result.scalars().first()
        if notif is None:
            raise HTTPException(status_code=404, detail="Notification not found")
        await db.delete(notif)


async def create_notification(
    db: AsyncSession, user_id: int, notif_type: str, message: str
) -> Notification:
    """Persist a new notification row and return it with its generated id.
    
    Validates message length before persisting to prevent abuse or database bloat.
    Uses savepoint (nested transaction) for atomicity within the existing session transaction.
    
    Args:
        db: Async database session
        user_id: Target user ID for the notification
        notif_type: Type of notification (validated by NotificationResponse schema)
        message: Human-readable notification message (max 256 characters)
        
    Raises:
        ValueError: If message exceeds MAX_NOTIFICATION_MESSAGE_LENGTH
    """
    # Validate message length
    if not message or len(message) > MAX_NOTIFICATION_MESSAGE_LENGTH:
        raise ValueError(
            f"Notification message must be 1-{MAX_NOTIFICATION_MESSAGE_LENGTH} characters "
            f"(got {len(message)} characters)"
        )
    
    notif = Notification(user_id=user_id, type=notif_type, message=message, read=False)
    async with db.begin_nested():
        db.add(notif)
        await db.flush()  # Ensure ID is generated before refresh
    return notif
