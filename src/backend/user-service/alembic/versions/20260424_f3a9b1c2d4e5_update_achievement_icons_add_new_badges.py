"""update_achievement_icons_add_new_badges

Updates existing win/twin badge icons to ASCIImoji and seeds the eight new
badges defined in the gamification design spec (2026-04-24).

Revision ID: f3a9b1c2d4e5
Revises: c6adf885432a
Create Date: 2026-04-24
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'f3a9b1c2d4e5'
down_revision: Union[str, None] = 'c6adf885432a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # ── Update existing badge icons to ASCIImoji ──────────────────────────────
    icon_updates = [
        ('win1',  '(•̀ᴗ•́)و'),
        ('win3',  'ᕦ(ò_óˇ)ᕤ'),
        ('win5',  "(ง'̀-'́)ง"),
        ('win10', 'ᕙ(⇀‸↼‶)ᕗ'),
        ('win25', r'\(^o^)/'),
        ('twin1', 'ʕ•ᴥ•ʔ╯'),
        ('twin3', 'ʕ•̫͡•ʔ'),
        ('twin5', 'ʕ⊙ᴥ⊙ʔ'),
    ]
    for key, icon in icon_updates:
        conn.execute(
            sa.text("UPDATE achievements SET icon = :icon WHERE key = :key"),
            {"icon": icon, "key": key},
        )

    # ── Seed new badges (idempotent — ON CONFLICT DO NOTHING) ─────────────────
    new_achievements = [
        ("first_game",       "Getting Started",   "Play your first game",            "(ง •_•)ง"),
        ("perfect_game",     "Perfect Pong",      "Win a game 10-0",                 "¬‿¬"),
        ("ai_conqueror",     "AI Conqueror",      "Beat the AI opponent",            "ʕっ•ᴥ•ʔっ"),
        ("first_friend",     "Not Alone",         "Add your first friend",           "(つ◕‿◕)つ"),
        ("social_butterfly", "Social Butterfly",  "Have 5 accepted friends",         "(づ｡◕‿‿◕｡)づ"),
        ("popular",          "The Popular One",   "Have 10 accepted friends",        "(ﾉ◕ヮ◕)ﾉ*:･ﾟ✧"),
        ("level_5",          "Rising Star",       "Reach Level 5",                   "★彡(◕‿◕)"),
        ("level_10",         "Elite Player",      "Reach Level 10",                  "(ﾉ≧∀≦)ﾉ"),
    ]
    conn.execute(
        sa.text(
            "INSERT INTO achievements (key, name, description, icon) "
            "VALUES (:key, :name, :description, :icon) "
            "ON CONFLICT (key) DO NOTHING"
        ),
        [
            {"key": k, "name": n, "description": d, "icon": i}
            for k, n, d, i in new_achievements
        ],
    )


def downgrade() -> None:
    conn = op.get_bind()

    # Restore original plain-text icons
    original_icons = [
        ('win1',  '(1)'),
        ('win3',  '(3)'),
        ('win5',  '(5)'),
        ('win10', '(10)'),
        ('win25', '(25)'),
        ('twin1', r'_\(1)/_'),
        ('twin3', r'_\(3)/_'),
        ('twin5', r'_\(5)/_'),
    ]
    for key, icon in original_icons:
        conn.execute(
            sa.text("UPDATE achievements SET icon = :icon WHERE key = :key"),
            {"icon": icon, "key": key},
        )

    # Remove seeded new badges
    new_keys = [
        "first_game", "perfect_game", "ai_conqueror",
        "first_friend", "social_butterfly", "popular",
        "level_5", "level_10",
    ]
    conn.execute(
        sa.text("DELETE FROM achievements WHERE key = ANY(:keys)"),
        {"keys": new_keys},
    )
