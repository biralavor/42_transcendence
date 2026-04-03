"""add tournaments table

Revision ID: b3c7f2a9d1e8
Revises: e53b819dcceb
Create Date: 2026-04-01 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'b3c7f2a9d1e8'
down_revision: Union[str, None] = 'e53b819dcceb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'tournaments',
        sa.Column('id', sa.Integer(), nullable=False),
        # Cross-service reference stored as plain integer — no ORM-level FK
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('creator_id', sa.Integer(), nullable=False),
        sa.Column('max_participants', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False, server_default=sa.text("'open'")),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('tournaments')
