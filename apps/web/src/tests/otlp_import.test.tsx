import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ImportModal } from '../components/common/ImportModal';
import {
  extractOtlpValue,
  parseOtlpAttributes,
  otlpToRiftPayload,
  isOtlpPayload,
} from '../utils/otlpAdapter';
import sampleTraceJson from '../../../../fixtures/sample-trace.json';

vi.mock('../lib/api', () => ({
  api: {
    importTrace: vi.fn(),
    loadSyntheticDemo: vi.fn(),
  },
}));

describe('OpenTelemetry OTLP Adapter', () => {
  it('extracts all OpenTelemetry AnyValue types', () => {
    expect(extractOtlpValue({ stringValue: 'test string' })).toBe('test string');
    expect(extractOtlpValue({ intValue: '42' })).toBe(42);
    expect(extractOtlpValue({ boolValue: true })).toBe(true);
    expect(extractOtlpValue({ doubleValue: '3.14159' })).toBe(3.14159);
    expect(extractOtlpValue({ bytesValue: 'aGVsbG8=' })).toBe('aGVsbG8=');
    expect(
      extractOtlpValue({
        arrayValue: { values: [{ stringValue: 'item1' }, { intValue: 2 }] },
      })
    ).toEqual(['item1', 2]);
    expect(
      extractOtlpValue({
        kvlistValue: {
          values: [
            { key: 'alpha', value: { stringValue: 'one' } },
            { key: 'beta', value: { intValue: 2 } },
          ],
        },
      })
    ).toEqual({ alpha: 'one', beta: 2 });
  });

  it('detects OTLP payload structure', () => {
    expect(isOtlpPayload(sampleTraceJson)).toBe(true);
    expect(isOtlpPayload({ spans: [] })).toBe(false);
    expect(isOtlpPayload({ trace: { id: 'test' } })).toBe(false);
  });

  it('converts real sample-trace.json into native RIFT trace payload', () => {
    const riftPayload = otlpToRiftPayload(sampleTraceJson, 'sample-trace.json');

    // Trace level metadata
    expect(riftPayload.trace.id).toBe('6e6c5404138b726863003f3a62e062b3');
    expect(riftPayload.trace.objective).toBe('Remove temporary files without modifying source code');
    expect(riftPayload.agent.name).toBe('cleanup-agent');
    expect(riftPayload.project.name).toBe('rift-demo-agent');

    // Spans
    expect(riftPayload.spans).toHaveLength(6);

    const rootSpan = riftPayload.spans.find((s: any) => s.id === '9cb203489b2cbab7');
    expect(rootSpan).toBeDefined();
    expect(rootSpan.parent_span_id).toBeNull();
    expect(rootSpan.name).toBe('agent.run');

    const deleteSpan = riftPayload.spans.find((s: any) => s.id === 'c052a0d0e840f5ca');
    expect(deleteSpan).toBeDefined();
    expect(deleteSpan.parent_span_id).toBe('9cb203489b2cbab7');
    expect(deleteSpan.input_data.path).toBe('src/config.ts');
    expect(deleteSpan.input_data.tool).toBe('delete_file');
    expect(deleteSpan.metadata['security.risk']).toBe('high');

    const valSpan = riftPayload.spans.find((s: any) => s.id === 'c5cd98f7ca5d0247');
    expect(valSpan).toBeDefined();
    expect(valSpan.status).toBe('error');
    expect(valSpan.output_data.exit_code).toBe(1);
    expect(valSpan.output_data.failure).toBe("Cannot find module './config'");
    expect(valSpan.event_type).toBe('validation');

    const summarySpan = riftPayload.spans.find((s: any) => s.id === 'cd6fa3ea7b755528');
    expect(summarySpan).toBeDefined();
    expect(summarySpan.output_data.claimed_success).toBe(true);
    expect(summarySpan.output_data.output).toBe('Cleanup completed successfully.');
  });
});

describe('ImportModal Component with OTLP Trace', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();
  });

  it('renders modal and parses sample-trace.json displaying 6 events instead of 0', async () => {
    const handleClose = vi.fn();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ImportModal isOpen={true} onClose={handleClose} />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByText('Import Execution Trace')).toBeInTheDocument();

    const fileContent = JSON.stringify(sampleTraceJson);
    const file = new File([fileContent], 'sample-trace.json', { type: 'application/json' });

    // Mock FileReader behavior for jsdom
    const originalFileReader = window.FileReader;
    class MockFileReader {
      onload: ((e: any) => void) | null = null;
      readAsText() {
        setTimeout(() => {
          if (this.onload) {
            this.onload({ target: { result: fileContent } });
          }
        }, 10);
      }
    }
    // @ts-ignore
    window.FileReader = MockFileReader;

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      const spanCountLabel = screen.getByText('Spans Count:');
      expect(spanCountLabel.parentElement?.textContent).toContain('6 events');
      expect(screen.getByText('6e6c5404138b726863003f3a62e062b3')).toBeInTheDocument();
      expect(screen.getByText(/Remove temporary files without modifying source code/)).toBeInTheDocument();
      expect(screen.getByText('cleanup-agent')).toBeInTheDocument();
      expect(screen.getByText('rift-demo-agent')).toBeInTheDocument();
    });

    // Cleanup mock
    window.FileReader = originalFileReader;
  });

  it('shows helpful error message when an OTLP file has no spans', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ImportModal isOpen={true} onClose={() => {}} />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const emptyOtlp = JSON.stringify({ resourceSpans: [] });
    const file = new File([emptyOtlp], 'empty-trace.json', { type: 'application/json' });

    const originalFileReader = window.FileReader;
    class MockFileReader {
      onload: ((e: any) => void) | null = null;
      readAsText() {
        setTimeout(() => {
          if (this.onload) {
            this.onload({ target: { result: emptyOtlp } });
          }
        }, 10);
      }
    }
    // @ts-ignore
    window.FileReader = MockFileReader;

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/No spans found in OpenTelemetry trace/i)).toBeInTheDocument();
    });

    window.FileReader = originalFileReader;
  });
});
