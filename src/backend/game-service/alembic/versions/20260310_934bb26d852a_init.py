"""init

Revision ID: 934bb26d852a
Revises:
Create Date: 2026-03-10 02:46:46.366839

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = '934bb26d852a'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'matches',
        sa.Column('id', sa.Integer(), nullable=False),
        # Cross-service references stored as plain integers — no ORM-level FK
        sa.Column('player1_id', sa.Integer(), nullable=False),
        sa.Column('player2_id', sa.Integer(), nullable=False),
        sa.Column('winner_id', sa.Integer(), nullable=True),
        sa.Column('score_p1', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('score_p2', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('started_at', sa.TIMESTAMP(), nullable=True),
        sa.Column('finished_at', sa.TIMESTAMP(), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('matches')
