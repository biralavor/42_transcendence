"""make_credential_id_not_null_in_users

Revision ID: 082195afefdc
Revises: f6a7b8c9d0e1
Create Date: 2026-03-25 12:00:43.944076

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '082195afefdc'
down_revision: Union[str, None] = 'f6a7b8c9d0e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("DELETE FROM users WHERE credential_id IS NULL")
    op.alter_column('users', 'credential_id', nullable=False)


def downgrade() -> None:
    op.alter_column('users', 'credential_id', nullable=True)
