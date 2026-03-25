"""replace email with credential_id in users table

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-03-24
"""
from typing import Union
import sqlalchemy as sa
from alembic import op

revision: str = 'f6a7b8c9d0e1'
down_revision: Union[str, None] = 'e5f6a7b8c9d0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column('users', 'email')
    op.add_column('users', sa.Column(
        'credential_id',
        sa.Integer(),
        sa.ForeignKey('credentials.id'),
        nullable=True,
        unique=True,
    ))


def downgrade() -> None:
    op.drop_column('users', 'credential_id')
    op.add_column('users', sa.Column(
        'email',
        sa.String(100),
        nullable=True,
        unique=True,
    ))
