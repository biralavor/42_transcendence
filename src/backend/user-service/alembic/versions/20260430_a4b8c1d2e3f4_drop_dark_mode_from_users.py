"""drop dark_mode from users

Revision ID: a4b8c1d2e3f4
Revises: f3a9b1c2d4e5
Create Date: 2026-04-30
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = 'a4b8c1d2e3f4'
down_revision: Union[str, None] = 'f3a9b1c2d4e5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column('users', 'dark_mode')


def downgrade() -> None:
    op.add_column(
        'users',
        sa.Column('dark_mode', sa.Boolean(), nullable=False, server_default='false'),
    )
