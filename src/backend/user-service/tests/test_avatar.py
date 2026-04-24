import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import MagicMock

from service.main import app, get_current_user
import service.avatar as avatar_module


JPEG_BYTES = b"\xFF\xD8\xFF\xE0" + b"\x00" * 100
PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100
WEBP_BYTES = b"RIFF\x00\x00\x00\x00WEBP" + b"\x00" * 100


def _make_user(user_id=9999):
    u = MagicMock()
    u.id = user_id
    u.avatar_url = None
    return u


@pytest.fixture
def avatar_dir(tmp_path, monkeypatch):
    d = tmp_path / "avatars"
    d.mkdir()
    monkeypatch.setattr(avatar_module, "AVATAR_DIR", d)
    return d


@pytest.mark.asyncio
async def test_upload_avatar_jpeg_happy_path(avatar_dir):
    user = _make_user()
    app.dependency_overrides[get_current_user] = lambda: user
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/avatar",
            files={"file": ("photo.jpg", JPEG_BYTES, "image/jpeg")},
        )
    assert resp.status_code == 200
    assert resp.json() == {"avatar_url": f"/uploads/avatars/{user.id}.jpg"}
    assert (avatar_dir / f"{user.id}.jpg").exists()
    assert user.avatar_url == f"/uploads/avatars/{user.id}.jpg"


@pytest.mark.asyncio
async def test_upload_avatar_png_and_webp(avatar_dir):
    user = _make_user()
    app.dependency_overrides[get_current_user] = lambda: user

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/avatar",
            files={"file": ("pic.png", PNG_BYTES, "image/png")},
        )
    assert resp.status_code == 200
    assert (avatar_dir / f"{user.id}.png").exists()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/avatar",
            files={"file": ("pic.webp", WEBP_BYTES, "image/webp")},
        )
    assert resp.status_code == 200
    # Prior png should have been cleaned up on re-upload.
    assert not (avatar_dir / f"{user.id}.png").exists()
    assert (avatar_dir / f"{user.id}.webp").exists()


@pytest.mark.asyncio
async def test_upload_avatar_rejects_unsupported_mime(avatar_dir):
    user = _make_user()
    app.dependency_overrides[get_current_user] = lambda: user
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/avatar",
            files={"file": ("note.txt", b"not an image", "text/plain")},
        )
    assert resp.status_code == 415


@pytest.mark.asyncio
async def test_upload_avatar_rejects_mismatched_magic_bytes(avatar_dir):
    user = _make_user()
    app.dependency_overrides[get_current_user] = lambda: user
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/avatar",
            files={"file": ("fake.png", JPEG_BYTES, "image/png")},
        )
    assert resp.status_code == 415


@pytest.mark.asyncio
async def test_upload_avatar_rejects_oversize(avatar_dir):
    user = _make_user()
    app.dependency_overrides[get_current_user] = lambda: user
    oversize = b"\xFF\xD8\xFF" + b"\x00" * (2 * 1024 * 1024 + 1)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/avatar",
            files={"file": ("big.jpg", oversize, "image/jpeg")},
        )
    assert resp.status_code == 413


@pytest.mark.asyncio
async def test_delete_avatar_removes_file_and_clears_url(avatar_dir):
    user = _make_user()
    user.avatar_url = f"/uploads/avatars/{user.id}.jpg"
    (avatar_dir / f"{user.id}.jpg").write_bytes(b"anything")
    app.dependency_overrides[get_current_user] = lambda: user
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.delete("/avatar")
    assert resp.status_code == 204
    assert not (avatar_dir / f"{user.id}.jpg").exists()
    assert user.avatar_url is None


@pytest.mark.asyncio
async def test_delete_avatar_idempotent_when_no_file(avatar_dir):
    user = _make_user()
    app.dependency_overrides[get_current_user] = lambda: user
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.delete("/avatar")
    assert resp.status_code == 204
    assert user.avatar_url is None


@pytest.mark.asyncio
async def test_upload_avatar_rolls_back_on_commit_failure(avatar_dir, mock_db_session):
    user = _make_user()
    mock_db_session.commit.side_effect = RuntimeError("db down")
    app.dependency_overrides[get_current_user] = lambda: user
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/avatar",
            files={"file": ("photo.jpg", JPEG_BYTES, "image/jpeg")},
        )
    assert resp.status_code == 500
    # No avatar artefacts left behind, avatar_url not mutated, rollback called.
    assert list(avatar_dir.iterdir()) == []
    assert user.avatar_url is None
    mock_db_session.rollback.assert_awaited()


@pytest.mark.asyncio
async def test_delete_avatar_rolls_back_on_commit_failure(avatar_dir, mock_db_session):
    user = _make_user()
    user.avatar_url = f"/uploads/avatars/{user.id}.jpg"
    file_path = avatar_dir / f"{user.id}.jpg"
    file_path.write_bytes(b"keep me")
    mock_db_session.commit.side_effect = RuntimeError("db down")
    app.dependency_overrides[get_current_user] = lambda: user
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.delete("/avatar")
    assert resp.status_code == 500
    # File stays, avatar_url unchanged, rollback called.
    assert file_path.exists()
    assert user.avatar_url == f"/uploads/avatars/{user.id}.jpg"
    mock_db_session.rollback.assert_awaited()


@pytest.mark.asyncio
async def test_avatar_endpoints_require_auth(avatar_dir):
    app.dependency_overrides.pop(get_current_user, None)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        post_resp = await ac.post(
            "/avatar",
            files={"file": ("x.jpg", JPEG_BYTES, "image/jpeg")},
        )
        delete_resp = await ac.delete("/avatar")
    assert post_resp.status_code in (401, 403)
    assert delete_resp.status_code in (401, 403)
