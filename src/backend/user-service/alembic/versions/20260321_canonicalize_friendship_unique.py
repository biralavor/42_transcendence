"""canonicalize friendship unique constraint

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-03-21

Replace the directional UniqueConstraint(requester_id, addressee_id) with a
LEAST/GREATEST functional unique index so that (A→B) and (B→A) are treated as
the same pair at the DB level, matching the application logic in friends.py.
"""
from typing import Union
from alembic import op

revision: str = 'e5f6a7b8c9d0'
down_revision: Union[str, None] = 'd4e5f6a7b8c9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint('uq_friendship_pair', 'friendships', type_='unique')
    op.execute("""
        CREATE UNIQUE INDEX uq_friendship_canonical
        ON friendships (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id))
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_friendship_canonical")
    op.create_unique_constraint('uq_friendship_pair', 'friendships', ['requester_id', 'addressee_id'])
