"""merge multiple heads

Revision ID: c2c6045ae605
Revises: e7dfb79cd018, d8fcaa003ff3
Create Date: 2026-04-13 04:39:30.810611

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c2c6045ae605'
down_revision: Union[str, None] = ('e7dfb79cd018', 'd8fcaa003ff3')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
