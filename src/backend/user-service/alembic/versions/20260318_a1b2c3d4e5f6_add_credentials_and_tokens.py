"""add_credentials_and_tokens

Revision ID: a1b2c3d4e5f6
Revises: 43bafb48a1a7
Create Date: 2026-03-18 19:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '43bafb48a1a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'credentials',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('username', sa.String(), nullable=False),
        sa.Column('password', sa.String(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('username'),
    )
    op.create_table(
        'tokens',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('credential_id', sa.Integer(), nullable=False),
        sa.Column('access_token', sa.String(), nullable=False),
        sa.Column('token_type', sa.String(), nullable=False),
        sa.Column('refresh_token', sa.String(), nullable=False),
        sa.ForeignKeyConstraint(['credential_id'], ['credentials.id']),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('tokens')
    op.drop_table('credentials')
