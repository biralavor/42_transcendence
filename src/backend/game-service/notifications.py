import httpx
from shared.config.settings import settings


async def send_tournament_notification(
    token: str,
    to_user_id: int,
    notif_type: str,
    tournament_id: int,
) -> None:
    payload = {
        "type": notif_type,
        "to_user_id": to_user_id,
        "tournament_id": tournament_id,
    }

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(
                f"{settings.USER_SERVICE_URL}/game-invites",
                json=payload,
                headers={"Authorization": f"Bearer {token}"},
            )
    except Exception:
        # best effort only
        return
