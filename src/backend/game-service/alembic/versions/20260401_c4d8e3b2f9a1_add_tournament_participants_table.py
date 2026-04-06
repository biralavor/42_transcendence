"""add tournament_participants table

Revision ID: c4d8e3b2f9a1
Revises: b3c7f2a9d1e8
Create Date: 2026-04-01 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'c4d8e3b2f9a1'
down_revision: Union[str, None] = 'b3c7f2a9d1e8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'tournament_participants',
        sa.Column('tournament_id', sa.Integer(), sa.ForeignKey('tournaments.id'), nullable=False),
        # Cross-service reference stored as plain integer — no ORM-level FK
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('joined_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('tournament_id', 'user_id'),
    )


def downgrade() -> None:
    op.drop_table('tournament_participants')
