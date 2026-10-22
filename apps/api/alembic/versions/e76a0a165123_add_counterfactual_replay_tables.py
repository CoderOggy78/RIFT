"""add_counterfactual_replay_tables

Revision ID: e76a0a165123
Revises: 64261edde251
Create Date: 2026-10-20 00:31:42.437526

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e76a0a165123'
down_revision: Union[str, Sequence[str], None] = '64261edde251'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = inspector.get_table_names()

    # 1. replays
    if 'replays' not in existing_tables:
        op.create_table(
            'replays',
            sa.Column('id', sa.String(length=64), nullable=False),
            sa.Column('incident_id', sa.String(length=64), nullable=False),
            sa.Column('investigation_id', sa.String(length=64), nullable=True),
            sa.Column('original_event_id', sa.String(length=64), nullable=False),
            sa.Column('status', sa.String(length=32), nullable=False),
            sa.Column('fixture_id', sa.String(length=64), nullable=False),
            sa.Column('approved_by_user', sa.Boolean(), nullable=False),
            sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('failure_code', sa.String(length=64), nullable=True),
            sa.Column('failure_message', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(['incident_id'], ['incidents.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['investigation_id'], ['investigations.id'], ondelete='SET NULL'),
            sa.PrimaryKeyConstraint('id')
        )
        with op.batch_alter_table('replays', schema=None) as batch_op:
            batch_op.create_index('idx_replay_incident_status', ['incident_id', 'status'], unique=False)
            batch_op.create_index(batch_op.f('ix_replays_incident_id'), ['incident_id'], unique=False)
            batch_op.create_index(batch_op.f('ix_replays_investigation_id'), ['investigation_id'], unique=False)
            batch_op.create_index(batch_op.f('ix_replays_original_event_id'), ['original_event_id'], unique=False)
            batch_op.create_index(batch_op.f('ix_replays_status'), ['status'], unique=False)

    # 2. replay_variants
    if 'replay_variants' not in existing_tables:
        op.create_table(
            'replay_variants',
            sa.Column('id', sa.String(length=64), nullable=False),
            sa.Column('replay_id', sa.String(length=64), nullable=False),
            sa.Column('variant_type', sa.String(length=32), nullable=False),
            sa.Column('operation_type', sa.String(length=32), nullable=False),
            sa.Column('validated_arguments', sa.JSON(), nullable=False),
            sa.Column('execution_status', sa.String(length=32), nullable=False),
            sa.Column('validation_status', sa.String(length=32), nullable=False),
            sa.Column('duration_ms', sa.Float(), nullable=True),
            sa.Column('error_message', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(['replay_id'], ['replays.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
        with op.batch_alter_table('replay_variants', schema=None) as batch_op:
            batch_op.create_index('idx_replay_variant_type', ['replay_id', 'variant_type'], unique=False)
            batch_op.create_index(batch_op.f('ix_replay_variants_replay_id'), ['replay_id'], unique=False)

    # 3. replay_artifacts
    if 'replay_artifacts' not in existing_tables:
        op.create_table(
            'replay_artifacts',
            sa.Column('id', sa.String(length=64), nullable=False),
            sa.Column('replay_variant_id', sa.String(length=64), nullable=False),
            sa.Column('artifact_type', sa.String(length=32), nullable=False),
            sa.Column('relative_path', sa.String(length=255), nullable=False),
            sa.Column('content_hash', sa.String(length=64), nullable=False),
            sa.Column('artifact_metadata', sa.JSON(), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(['replay_variant_id'], ['replay_variants.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
        with op.batch_alter_table('replay_artifacts', schema=None) as batch_op:
            batch_op.create_index('idx_rplart_variant_type', ['replay_variant_id', 'artifact_type'], unique=False)
            batch_op.create_index(batch_op.f('ix_replay_artifacts_replay_variant_id'), ['replay_variant_id'], unique=False)

    # 4. replay_comparisons
    if 'replay_comparisons' not in existing_tables:
        op.create_table(
            'replay_comparisons',
            sa.Column('id', sa.String(length=64), nullable=False),
            sa.Column('replay_id', sa.String(length=64), nullable=False),
            sa.Column('original_validation_status', sa.String(length=32), nullable=False),
            sa.Column('counterfactual_validation_status', sa.String(length=32), nullable=False),
            sa.Column('changed_files', sa.JSON(), nullable=False),
            sa.Column('removed_files', sa.JSON(), nullable=False),
            sa.Column('added_files', sa.JSON(), nullable=False),
            sa.Column('conclusion', sa.String(length=64), nullable=False),
            sa.Column('details', sa.JSON(), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(['replay_id'], ['replays.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
        with op.batch_alter_table('replay_comparisons', schema=None) as batch_op:
            batch_op.create_index(batch_op.f('ix_replay_comparisons_replay_id'), ['replay_id'], unique=True)


def downgrade() -> None:
    op.drop_table('replay_comparisons')
    op.drop_table('replay_artifacts')
    op.drop_table('replay_variants')
    op.drop_table('replays')
