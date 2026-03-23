"""harden_tokens_table

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-03-18 20:00:00.000000

Remove plaintext access_token, rename refresh_token to refresh_token_hash,
add created_at/expires_at so tokens can be validated and revoked without
retaining usable secrets in the DB.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column('tokens', 'access_token')
    op.alter_column('tokens', 'refresh_token', new_column_name='refresh_token_hash')
    op.add_column('tokens', sa.Column(
        'created_at',
        sa.TIMESTAMP(timezone=True),
        nullable=False,
        server_default=sa.text('now()'),
    ))
    op.add_column('tokens', sa.Column(
        'expires_at',
        sa.TIMESTAMP(timezone=True),
        nullable=False,
        server_default=sa.text('now() + interval \'30 days\''),
    ))


def downgrade() -> None:
    op.drop_column('tokens', 'expires_at')
    op.drop_column('tokens', 'created_at')
    op.alter_column('tokens', 'refresh_token_hash', new_column_name='refresh_token')
    op.add_column('tokens', sa.Column('access_token', sa.String(), nullable=False, server_default=''))
