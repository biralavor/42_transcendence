import asyncio
from pathlib import Path

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from service.models.user import User

ALLOWED_MIMES: dict[str, str] = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}
MAX_BYTES = 2 * 1024 * 1024
AVATAR_DIR = Path("/app/uploads/avatars")


def _magic_matches(ext: str, data: bytes) -> bool:
    if ext == "jpg":
        return data.startswith(b"\xFF\xD8\xFF")
    if ext == "png":
        return data.startswith(b"\x89PNG\r\n\x1a\n")
    if ext == "webp":
        return len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP"
    return False


def _remove_existing(user_id: int, keep: Path | None = None) -> None:
    for path in AVATAR_DIR.glob(f"{user_id}.*"):
        if keep is not None and path == keep:
            continue
        try:
            path.unlink()
        except FileNotFoundError:
            pass




async def save_avatar(user: User, file: UploadFile, session: AsyncSession) -> dict:
    ext = ALLOWED_MIMES.get(file.content_type)
    if ext is None:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Only JPEG, PNG, and WebP images are allowed",
        )

    data = await file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File exceeds 2 MB limit",
        )

    if not _magic_matches(ext, data):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="File content does not match declared image type",
        )

    await asyncio.to_thread(AVATAR_DIR.mkdir, parents=True, exist_ok=True)

    # Write to a sidecar path that does NOT match the "{user_id}.*" glob,
    # so it survives _remove_existing and is only promoted once commit succeeds.
    tmp_path = AVATAR_DIR / f".tmp_{user.id}_{ext}"
    final_path = AVATAR_DIR / f"{user.id}.{ext}"
    await asyncio.to_thread(tmp_path.write_bytes, data)

    previous_url = user.avatar_url
    user.avatar_url = f"/uploads/avatars/{user.id}.{ext}"
    try:
        await session.commit()
    except Exception as exc:
        user.avatar_url = previous_url
        try:
            await session.rollback()
        except Exception:
            pass
        await asyncio.to_thread(tmp_path.unlink, missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save avatar",
        ) from exc

    # Commit succeeded — make the file visible, then clean up prior-extension leftovers.
    await asyncio.to_thread(tmp_path.replace, final_path)
    await asyncio.to_thread(_remove_existing, user.id, final_path)
    return {"avatar_url": user.avatar_url}


async def clear_avatar(user: User, session: AsyncSession) -> None:
    previous_url = user.avatar_url
    user.avatar_url = None
    try:
        await session.commit()
    except Exception as exc:
        user.avatar_url = previous_url
        try:
            await session.rollback()
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to clear avatar",
        ) from exc

    await asyncio.to_thread(_remove_existing, user.id)
