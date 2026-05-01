"""add_email_to_credentials

Revision ID: c7e2d4a09b18
Revises: b5e8a91f3c20
Create Date: 2026-05-01 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c7e2d4a09b18'
down_revision: Union[str, None] = 'b5e8a91f3c20'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'credentials',
        sa.Column('email', sa.String(), nullable=False),
    )
    op.create_unique_constraint('uq_credentials_email', 'credentials', ['email'])


def downgrade() -> None:
    op.drop_constraint('uq_credentials_email', 'credentials', type_='unique')
    op.drop_column('credentials', 'email')
