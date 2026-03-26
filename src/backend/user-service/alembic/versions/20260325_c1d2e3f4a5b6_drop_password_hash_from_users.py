"""drop_password_hash_from_users

Revision ID: c1d2e3f4a5b6
Revises: 082195afefdc
Create Date: 2026-03-25 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c1d2e3f4a5b6'
down_revision: Union[str, None] = '082195afefdc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column('users', 'password_hash')


def downgrade() -> None:
    op.add_column('users', sa.Column('password_hash', sa.String(), nullable=True))
