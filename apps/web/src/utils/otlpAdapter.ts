/**
 * OpenTelemetry (OTLP) to RIFT Trace Adapter for Frontend.
 *
 * Translates standard OpenTelemetry JSON trace exports (resourceSpans, scopeSpans, spans)
 * into native RIFT execution trace models (project, agent, trace, spans).
 */

export function extractOtlpValue(val: any): any {
  if (val === null || val === undefined) return val;
  if (typeof val !== 'object') return val;

  if ('stringValue' in val) return val.stringValue;
  if ('intValue' in val) {
    const n = Number(val.intValue);
    return Number.isSafeInteger(n) ? n : val.intValue;
  }
  if ('boolValue' in val) return Boolean(val.boolValue);
  if ('doubleValue' in val) {
    const n = Number(val.doubleValue);
    return isNaN(n) ? val.doubleValue : n;
  }
  if ('bytesValue' in val) return val.bytesValue;
  if ('arrayValue' in val) {
    const items = val.arrayValue?.values || [];
    return items.map(extractOtlpValue);
  }
  if ('kvlistValue' in val) {
    const items = val.kvlistValue?.values || [];
    const res: Record<string, any> = {};
    for (const item of items) {
      if (item && item.key) {
        res[item.key] = extractOtlpValue(item.value);
      }
    }
    return res;
  }

  // Already a dictionary / plain object
  const res: Record<string, any> = {};
  for (const [k, v] of Object.entries(val)) {
    res[k] = extractOtlpValue(v);
  }
  return res;
}

export function parseOtlpAttributes(attrs: any): Record<string, any> {
  const res: Record<string, any> = {};
  if (!attrs) return res;

  if (Array.isArray(attrs)) {
    for (const item of attrs) {
      if (item && typeof item === 'object' && 'key' in item) {
        res[item.key] = extractOtlpValue(item.value);
      }
    }
    return res;
  }

  if (typeof attrs === 'object') {
    for (const [k, v] of Object.entries(attrs)) {
      res[k] = extractOtlpValue(v);
    }
    return res;
  }

  return res;
}

export function parseUnixNanoToIso(val: any): string {
  if (!val) return new Date().toISOString();
  if (typeof val === 'number') {
    if (val > 1e16) return new Date(val / 1e6).toISOString();
    if (val > 1e12) return new Date(val).toISOString();
    return new Date(val * 1000).toISOString();
  }
  if (typeof val === 'string') {
    const s = val.trim();
    try {
      const bn = BigInt(s);
      if (bn > 10000000000000000n) {
        // Nanoseconds to milliseconds
        const ms = Number(bn / 1000000n);
        return new Date(ms).toISOString();
      } else if (bn > 1000000000000n) {
        return new Date(Number(bn)).toISOString();
      }
    } catch {
      // not a bigint string
    }
    try {
      const d = new Date(s);
      if (!isNaN(d.getTime())) return d.toISOString();
    } catch {
      // fallback
    }
  }
  return new Date().toISOString();
}

export function isOtlpPayload(data: any): boolean {
  if (!data || typeof data !== 'object') return false;
  return Array.isArray(data.resourceSpans) || Array.isArray(data.scopeSpans);
}

export function inferEventType(name: string, attrs: Record<string, any>): string {
  const nameLower = (name || '').toLowerCase();
  if (attrs.event_type) return String(attrs.event_type);
  if (nameLower.includes('validation') || attrs['tool.operation'] === 'test' || attrs['tool.name'] === 'test-runner') {
    return 'validation';
  }
  if (nameLower.startsWith('tool.') || 'tool.name' in attrs || 'tool.operation' in attrs) {
    return 'tool_call';
  }
  if (nameLower.includes('plan') || attrs['agent.action'] === 'plan') {
    return 'agent_plan';
  }
  if (nameLower.includes('user') || nameLower.includes('prompt') || nameLower.includes('instruction')) {
    return 'user_prompt';
  }
  if (nameLower.includes('model') || nameLower.includes('llm') || nameLower.startsWith('openai.') || nameLower.startsWith('anthropic.')) {
    return 'model_call';
  }
  if (nameLower.includes('response') || nameLower.startsWith('agent.')) {
    return 'agent_plan';
  }
  if (nameLower.includes('error')) {
    return 'error';
  }
  return nameLower.includes('tool') ? 'tool_call' : 'agent_plan';
}

export function otlpToRiftPayload(data: any, fallbackFileName?: string): any {
  const resourceAttrs: Record<string, any> = {};
  const rawSpans: any[] = [];

  const resourceSpans = data.resourceSpans || (data.scopeSpans ? [{ scopeSpans: data.scopeSpans }] : []);

  for (const rSpan of resourceSpans) {
    if (rSpan.resource?.attributes) {
      Object.assign(resourceAttrs, parseOtlpAttributes(rSpan.resource.attributes));
    }
    for (const sSpan of rSpan.scopeSpans || []) {
      const scopeInfo = sSpan.scope || {};
      for (const span of sSpan.spans || []) {
        span._scope = scopeInfo;
        rawSpans.push(span);
      }
    }
  }

  if (rawSpans.length === 0) {
    throw new Error('No spans found in OpenTelemetry trace payload (resourceSpans is empty).');
  }

  const primaryTraceId = rawSpans[0].traceId || rawSpans[0].trace_id || 'otel-trace';
  const allSpanAttrs = rawSpans.map((s) => parseOtlpAttributes(s.attributes));

  const projectName =
    resourceAttrs['service.name'] ||
    resourceAttrs['service_name'] ||
    allSpanAttrs[0]?.['service.name'] ||
    'OpenTelemetry Agent Service';
  const projectId = `proj-${projectName.toLowerCase().replace(/[^a-z0-9_-]/g, '-')}`;

  let agentName = 'Autonomous Agent';
  let agentFramework = 'OpenTelemetry / Agent API';

  for (const attrs of allSpanAttrs) {
    if (attrs['agent.name']) {
      agentName = String(attrs['agent.name']);
      break;
    }
    if (attrs['service.name'] && agentName === 'Autonomous Agent') {
      agentName = String(attrs['service.name']);
    }
  }

  for (const s of rawSpans) {
    if (s._scope?.name) {
      agentFramework = `${s._scope.name} v${s._scope.version || '1.0.0'}`;
      break;
    }
  }

  let objective = '';
  for (const attrs of allSpanAttrs) {
    if (attrs['agent.task']) {
      objective = String(attrs['agent.task']);
      break;
    }
    if (attrs['agent.instruction']) {
      objective = String(attrs['agent.instruction']);
      break;
    }
    if (attrs['task']) {
      objective = String(attrs['task']);
      break;
    }
  }

  if (!objective) {
    objective = fallbackFileName ? `Execution trace from ${fallbackFileName}` : `Execution trace (${rawSpans[0].name || 'agent.run'})`;
  }

  const spanIdSet = new Set(rawSpans.map((s) => s.spanId || s.id).filter(Boolean));
  let traceHasError = false;
  let minStart: Date | null = null;
  let maxEnd: Date | null = null;

  const normalizedSpans = rawSpans.map((s, idx) => {
    const spanId = s.spanId || s.id || `span-${idx + 1}`;
    let parentId = s.parentSpanId || s.parent_span_id || null;
    if (parentId === '' || parentId === spanId || (parentId && !spanIdSet.has(parentId))) {
      parentId = null;
    }

    const name = s.name || `operation_${idx + 1}`;
    const attrs = allSpanAttrs[idx] || {};

    const startIso = parseUnixNanoToIso(s.startTimeUnixNano || s.start_time);
    const endIso = parseUnixNanoToIso(s.endTimeUnixNano || s.end_time);

    const startDate = new Date(startIso);
    const endDate = new Date(endIso);

    if (!minStart || startDate < minStart) minStart = startDate;
    if (!maxEnd || endDate > maxEnd) maxEnd = endDate;

    let durationMs = 0;
    if (s.startTimeUnixNano && s.endTimeUnixNano) {
      try {
        const diffNs = BigInt(s.endTimeUnixNano) - BigInt(s.startTimeUnixNano);
        durationMs = Math.max(0, Number(diffNs) / 1e6);
      } catch {
        durationMs = Math.max(0, endDate.getTime() - startDate.getTime());
      }
    } else {
      durationMs = Math.max(0, endDate.getTime() - startDate.getTime());
    }

    const statusCode = s.status?.code;
    const isError =
      statusCode === 2 ||
      String(statusCode).toUpperCase() === 'STATUS_CODE_ERROR' ||
      Number(attrs['test.exit_code'] || 0) !== 0 ||
      Number(attrs['exit_code'] || 0) !== 0 ||
      Boolean(attrs['test.failure']) ||
      Boolean(attrs['error']);

    if (isError) traceHasError = true;

    const eventType = inferEventType(name, attrs);

    const inputData: Record<string, any> = {};
    const outputData: Record<string, any> = {};
    const errorData: Record<string, any> = {};
    const metadata: Record<string, any> = { ...attrs, resource: resourceAttrs };

    if (attrs['file.path']) {
      inputData.path = attrs['file.path'];
      inputData.file = attrs['file.path'];
      inputData.target = attrs['file.path'];
    }

    if (attrs['file.operation']) {
      inputData.operation = attrs['file.operation'];
    }

    if (attrs['tool.name']) {
      const tOp = attrs['tool.operation'] || '';
      if (tOp === 'delete') {
        inputData.tool = 'delete_file';
      } else if (tOp === 'list') {
        inputData.tool = 'list_directory';
      } else {
        inputData.tool = tOp ? `${attrs['tool.name']}.${tOp}` : attrs['tool.name'];
      }
    } else if (name.startsWith('tool.')) {
      const parts = name.split('.');
      if (parts.length >= 2) {
        inputData.tool = parts[parts.length - 1];
      }
    }

    if (attrs['test.command']) {
      inputData.command = attrs['test.command'];
      inputData.test_command = attrs['test.command'];
    }

    if (attrs['agent.output']) {
      outputData.output = attrs['agent.output'];
      outputData.agent_response = attrs['agent.output'];
      outputData.summary = attrs['agent.output'];
    }

    if (attrs['agent.claimed_success'] !== undefined) {
      outputData.claimed_success = Boolean(attrs['agent.claimed_success']);
    }

    if (attrs['test.exit_code'] !== undefined) {
      outputData.exit_code = Number(attrs['test.exit_code']);
    }

    if (attrs['test.failure']) {
      outputData.failure = attrs['test.failure'];
      errorData.error = attrs['test.failure'];
    }

    if (isError && Object.keys(errorData).length === 0) {
      errorData.error = s.status?.message || attrs['error.message'] || 'Span completed with error status';
    }

    return {
      id: spanId,
      parent_span_id: parentId,
      event_type: eventType,
      name,
      timestamp: startIso,
      duration_ms: durationMs,
      status: isError ? 'error' : 'success',
      input_data: inputData,
      output_data: outputData,
      error_data: errorData,
      metadata,
    };
  });

  return {
    project: {
      id: projectId,
      name: projectName,
      description: resourceAttrs['deployment.environment'] || 'OpenTelemetry ingested agent trace',
    },
    agent: {
      id: `agent-${agentName.toLowerCase().replace(/[^a-z0-9_-]/g, '-')}`,
      name: agentName,
      framework: agentFramework,
    },
    trace: {
      id: primaryTraceId,
      objective,
      status: traceHasError ? 'error' : 'success',
      started_at: minStart ? (minStart as Date).toISOString() : new Date().toISOString(),
      ended_at: maxEnd ? (maxEnd as Date).toISOString() : new Date().toISOString(),
    },
    spans: normalizedSpans,
  };
}
