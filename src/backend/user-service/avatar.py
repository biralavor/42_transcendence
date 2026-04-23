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


def _remove_existing(user_id: int) -> None:
    for path in AVATAR_DIR.glob(f"{user_id}.*"):
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

    AVATAR_DIR.mkdir(parents=True, exist_ok=True)
    _remove_existing(user.id)

    final_path = AVATAR_DIR / f"{user.id}.{ext}"
    tmp_path = AVATAR_DIR / f"{user.id}.{ext}.tmp"
    tmp_path.write_bytes(data)
    tmp_path.replace(final_path)

    user.avatar_url = f"/uploads/avatars/{user.id}.{ext}"
    await session.commit()
    return {"avatar_url": user.avatar_url}


async def clear_avatar(user: User, session: AsyncSession) -> None:
    _remove_existing(user.id)
    user.avatar_url = None
    await session.commit()
