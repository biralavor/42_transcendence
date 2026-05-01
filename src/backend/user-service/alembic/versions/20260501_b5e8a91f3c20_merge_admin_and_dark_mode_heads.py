"""merge admin and dark_mode heads

Revision ID: b5e8a91f3c20
Revises: a8b2c4d6e8f0, a4b8c1d2e3f4
Create Date: 2026-05-01 02:00:00.000000

Merges two parallel migrations that both branch off f3a9b1c2d4e5:
  - a8b2c4d6e8f0 (add_admin_login_tracking) — from feature branch
  - a4b8c1d2e3f4 (drop_dark_mode_from_users) — from develop

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b5e8a91f3c20'
down_revision: Union[str, None] = ('a8b2c4d6e8f0', 'a4b8c1d2e3f4')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
