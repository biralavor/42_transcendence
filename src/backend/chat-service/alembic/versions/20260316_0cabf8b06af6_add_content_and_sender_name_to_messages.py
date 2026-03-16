"""add_content_and_sender_name_to_messages

Revision ID: 0cabf8b06af6
Revises: 2ad13c20c91c
Create Date: 2026-03-16 01:18:35.936597

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0cabf8b06af6'
down_revision: Union[str, None] = '2ad13c20c91c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Relax NOT NULL on user_id (was nullable=False in init migration)
    op.alter_column('messages', 'user_id', nullable=True)
    # 2. Rename message → content
    op.alter_column('messages', 'message', new_column_name='content')
    # 3. Add sender_name column
    op.add_column('messages', sa.Column('sender_name', sa.String(50), nullable=True))


def downgrade() -> None:
    op.drop_column('messages', 'sender_name')
    op.alter_column('messages', 'content', new_column_name='message')
    op.alter_column('messages', 'user_id', nullable=False)
