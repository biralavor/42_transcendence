"""merge heads

Revision ID: 11ca8d5455e9
Revises: a1b2c3d4e5f7, c2c6045ae605
Create Date: 2026-04-13 23:39:30.190810

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '11ca8d5455e9'
down_revision: Union[str, None] = ('a1b2c3d4e5f7', 'c2c6045ae605')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
