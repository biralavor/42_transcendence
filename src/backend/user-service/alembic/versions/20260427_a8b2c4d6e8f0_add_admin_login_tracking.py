"""add admin role and login tracking

Adds:
- users.is_admin (BOOLEAN NOT NULL DEFAULT false)
- users.last_login_at (TIMESTAMP NULL) — naive to match users.created_at
- user_login_days table (one row per user per calendar day they logged in)
  used to compute consecutive-day streaks for the per-user activity endpoint.

Revision ID: a8b2c4d6e8f0
Revises: f3a9b1c2d4e5
Create Date: 2026-04-27 00:00:00.000000
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = 'a8b2c4d6e8f0'
down_revision: Union[str, None] = 'f3a9b1c2d4e5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column(
        'is_admin', sa.Boolean(), nullable=False, server_default='false'
    ))
    op.add_column('users', sa.Column('last_login_at', sa.TIMESTAMP(), nullable=True))

    op.create_table(
        'user_login_days',
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('login_date', sa.Date(), nullable=False),
        sa.PrimaryKeyConstraint('user_id', 'login_date', name='pk_user_login_days'),
        sa.Index('ix_user_login_days_user_id_date_desc', 'user_id', sa.text('login_date DESC')),
    )


def downgrade() -> None:
    op.drop_table('user_login_days')
    op.drop_column('users', 'last_login_at')
    op.drop_column('users', 'is_admin')
