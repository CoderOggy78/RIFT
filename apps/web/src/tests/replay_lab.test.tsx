import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReplayCapabilitiesBanner } from '../components/replay/ReplayCapabilitiesBanner';
import { ReplayConfigurationCard } from '../components/replay/ReplayConfigurationCard';
import { SecurityPreviewModal } from '../components/replay/SecurityPreviewModal';
import { ReplayComparisonPanel } from '../components/replay/ReplayComparisonPanel';
import { FilesystemDiffViewer } from '../components/replay/FilesystemDiffViewer';
import { ReplayAuditManifestModal } from '../components/replay/ReplayAuditManifestModal';
import { ReplayCapabilities, ReplayPreview, Replay, ReplayComparison, Incident, ReplayFixture } from '../types';

const mockCapabilities: ReplayCapabilities = {
  available: false,
  runtime: 'none',
  message: 'Secure replay is unavailable in this environment.',
  supported_operations: ['delete_file', 'write_file', 'move_file', 'run_validation'],
  security_constraints: {
    no_host_execution: true,
    unprivileged_user: '10001:10001',
    network_mode: 'none',
    read_only_root: true,
    cap_drop: ['ALL'],
    memory_limit: '256m',
    cpu_limit: 1.0,
    timeout_seconds: 30,
  },
};

const mockIncidents: Incident[] = [
  {
    id: 'inc-001',
    trace_id: 'trace-1',
    title: "Unsafe Deletion of 'src/config.ts'",
    description: 'Agent called delete_file on protected file src/config.ts.',
    severity: 'Critical',
    status: 'open',
    agent_name: 'test-agent',
    project_name: 'test-project',
    detection_count: 1,
    created_at: '2026-10-20T00:00:00Z',
    updated_at: '2026-10-20T00:00:00Z',
  },
];

const mockFixtures: ReplayFixture[] = [
  {
    fixture_id: 'accidental_deletion_v1',
    title: 'Accidental Deletion Reproduction Fixture',
    description: 'Demonstration of source protection invariant failure vs temporary cache clearing.',
    allowed_operations: ['delete_file', 'write_file', 'move_file', 'run_validation'],
    protected_paths: ['src/*', 'package.json'],
    permitted_paths: ['tmp/*'],
    initial_file_count: 4,
    snapshot_integrity_hash: '6251b0f373af3e0f44e650f721f471de41ff268c39b6452cd255e19d2c675537',
  },
];

const mockPreview: ReplayPreview = {
  incident_id: 'inc-001',
  incident_title: "Unsafe Deletion of 'src/config.ts'",
  original_event_id: 'span-del-001',
  fixture: {
    fixture_id: 'accidental_deletion_v1',
    title: 'Accidental Deletion Reproduction Fixture',
    description: 'Demonstration of source protection invariant failure vs temporary cache clearing.',
    protected_paths: ['src/*', 'package.json'],
    permitted_paths: ['tmp/*'],
    initial_files: ['src/config.ts', 'src/main.ts', 'package.json', 'tmp/cache.json'],
  },
  original_preview: {
    operation: 'delete_file',
    arguments: { path: 'src/config.ts' },
    target_paths: ['src/config.ts'],
    affects_protected: true,
    matching_protected_rule: 'src/*',
  },
  counterfactual_preview: {
    operation: 'delete_file',
    arguments: { path: 'tmp/cache.json' },
    target_paths: ['tmp/cache.json'],
    affects_protected: false,
  },
  sandbox_capabilities: mockCapabilities,
  can_execute: true,
  requires_explicit_approval: true,
};

const mockComparison: ReplayComparison = {
  id: 'comp-101',
  replay_id: 'rep-001',
  original_validation_status: 'failed',
  counterfactual_validation_status: 'passed',
  changed_files: [],
  removed_files: ['tmp/cache.json'],
  added_files: [],
  conclusion: 'counterfactual_passed_original_failed',
  details: {
    original_execution_status: 'success',
    counterfactual_execution_status: 'success',
    original_diff: {
      added_files: [],
      removed_files: ['src/config.ts'],
      modified_files: [],
      unchanged_files: ['package.json', 'src/main.ts'],
      file_diffs: {},
    },
    counterfactual_diff: {
      added_files: [],
      removed_files: ['tmp/cache.json'],
      modified_files: [],
      unchanged_files: ['package.json', 'src/config.ts', 'src/main.ts'],
      file_diffs: {},
    },
  },
};

const mockReplay: Replay = {
  id: 'rep-001',
  incident_id: 'inc-001',
  original_event_id: 'span-del-001',
  status: 'completed',
  fixture_id: 'accidental_deletion_v1',
  approved_by_user: true,
  approved_at: '2026-10-20T00:00:00Z',
  started_at: '2026-10-20T00:00:01Z',
  completed_at: '2026-10-20T00:00:03Z',
  created_at: '2026-10-20T00:00:00Z',
  variants: [
    {
      id: 'var-orig-01',
      replay_id: 'rep-001',
      variant_type: 'original',
      operation_type: 'delete_file',
      validated_arguments: { path: 'src/config.ts' },
      execution_status: 'success',
      validation_status: 'failed',
      duration_ms: 120,
    },
    {
      id: 'var-cf-01',
      replay_id: 'rep-001',
      variant_type: 'counterfactual',
      operation_type: 'delete_file',
      validated_arguments: { path: 'tmp/cache.json' },
      execution_status: 'success',
      validation_status: 'passed',
      duration_ms: 95,
    },
  ],
  comparison: mockComparison,
};

describe('ReplayCapabilitiesBanner Component', () => {
  it('renders exact unavailable notice when Docker is absent', () => {
    render(<ReplayCapabilitiesBanner capabilities={mockCapabilities} />);

    expect(
      screen.getByText('Secure replay is unavailable in this environment.')
    ).toBeInTheDocument();
    expect(screen.getByText(/Non-Root/i)).toBeInTheDocument();
    expect(screen.getByText(/Isolated/i)).toBeInTheDocument();
  });

  it('renders available badge when sandbox is enabled', () => {
    const availableCaps: ReplayCapabilities = {
      ...mockCapabilities,
      available: true,
      runtime: 'docker',
    };
    render(<ReplayCapabilitiesBanner capabilities={availableCaps} />);

    expect(screen.getByText('Secure Container Sandbox Active')).toBeInTheDocument();
  });
});

describe('ReplayConfigurationCard Component', () => {
  it('renders incident selector and typed operation options', () => {
    const onOpChange = vi.fn();
    const onArgsChange = vi.fn();
    const onPreview = vi.fn();

    render(
      <ReplayConfigurationCard
        incidents={mockIncidents}
        selectedIncidentId="inc-001"
        onSelectIncident={vi.fn()}
        fixtures={mockFixtures}
        selectedFixtureId="accidental_deletion_v1"
        onSelectFixture={vi.fn()}
        operationType="delete_file"
        onChangeOperationType={onOpChange}
        argumentsJson={{ path: 'tmp/cache.json' }}
        onChangeArguments={onArgsChange}
        onPreview={onPreview}
        isGeneratingPreview={false}
        canExecute={true}
      />
    );

    // Verify incident details
    expect(screen.getByText(/Unsafe Deletion of 'src\/config.ts'/i)).toBeInTheDocument();
    expect(screen.getByText(/Original Failing Action/i)).toBeInTheDocument();
    expect(screen.getByText(/Counterfactual Correction/i)).toBeInTheDocument();

    // Verify operation dropdown
    const selects = screen.getAllByRole('combobox');
    expect(selects.length).toBeGreaterThanOrEqual(1);

    // Verify preview button
    const previewBtn = screen.getByRole('button', { name: /Preview Replay & Security Boundary/i });
    expect(previewBtn).toBeInTheDocument();
    fireEvent.click(previewBtn);
    expect(onPreview).toHaveBeenCalled();
  });
});

describe('SecurityPreviewModal Component', () => {
  it('renders unchecked approval by default and disables execution until checked', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();

    render(
      <SecurityPreviewModal
        isOpen={true}
        onClose={onClose}
        preview={mockPreview}
        onConfirmReplay={onConfirm}
        isExecuting={false}
      />
    );

    // Verify title and security controls
    expect(screen.getByText('Security Preview & Replay Authorization')).toBeInTheDocument();
    expect(screen.getByText('Mandatory Sandbox Isolation Controls')).toBeInTheDocument();
    expect(screen.getByText('Variant 1: Original Action')).toBeInTheDocument();
    expect(screen.getByText('Variant 2: Counterfactual')).toBeInTheDocument();

    // Verify checkbox is NOT checked by default
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();

    // Confirm button should be disabled
    const confirmBtn = screen.getByRole('button', { name: /Confirm & Execute Replay/i });
    expect(confirmBtn).toBeDisabled();

    // Checking the box enables the button
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
    expect(confirmBtn).not.toBeDisabled();

    // Clicking confirm calls onConfirmReplay
    fireEvent.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalled();
  });
});

describe('ReplayComparisonPanel Component', () => {
  it('renders side-by-side comparison with validation outcomes', () => {
    render(
      <ReplayComparisonPanel
        replay={mockReplay}
        onOpenDiff={vi.fn()}
        onOpenManifest={vi.fn()}
      />
    );

    // Verification of variants
    expect(screen.getByText('Original Execution')).toBeInTheDocument();
    expect(screen.getAllByText(/Counterfactual Correction/i).length).toBeGreaterThanOrEqual(1);

    // Outcome conclusion
    expect(
      screen.getByText(/Verified: Counterfactual Correction Succeeded/i)
    ).toBeInTheDocument();

    // Validation badges
    expect(screen.getByText('Validation: FAILED')).toBeInTheDocument();
    expect(screen.getByText('Validation: PASSED')).toBeInTheDocument();
  });
});

describe('FilesystemDiffViewer Component', () => {
  it('displays removed and unchanged files for counterfactual execution', () => {
    render(<FilesystemDiffViewer comparison={mockComparison} />);

    expect(screen.getByText('Filesystem Mutation & Invariant Inspector')).toBeInTheDocument();
    expect(screen.getByText('tmp/cache.json')).toBeInTheDocument();
    expect(screen.getAllByText('src/config.ts').length).toBeGreaterThanOrEqual(1);
  });
});

describe('ReplayAuditManifestModal Component', () => {
  it('displays machine-readable manifest and reproduction data', () => {
    render(
      <ReplayAuditManifestModal
        isOpen={true}
        onClose={vi.fn()}
        replay={mockReplay}
      />
    );

    expect(screen.getByText('Machine-Readable Audit Manifest')).toBeInTheDocument();
    expect(screen.getAllByText(/rep-001/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Copy JSON')).toBeInTheDocument();
    expect(screen.getByText('Download Manifest')).toBeInTheDocument();
  });
});
