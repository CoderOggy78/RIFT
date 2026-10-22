# RIFT Investigation Workspace & Execution Graph

> *Between what agents intend and what they do.*

The **RIFT Investigation Workspace** transforms AI-agent observability from a static trace viewer into an interactive engineering workbench. It is designed for understanding, isolating, and diagnosing complex multi-step AI agent failures, state drift, and policy violations.

---

## 1. Architecture Overview

The Investigation Workspace is mounted at `/investigations/:traceId` (with trace index at `/investigations`) and is organized around a synchronized three-panel layout:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 INVESTIGATION HEADER                                   │
│ [<- Traces]  Trace ID | Agent | Objective | Status | Incidents | [Graph / Intent]       │
├─────────────────────┬───────────────────────────────────────────┬──────────────────────┤
│                     │                                           │                      │
│  EXECUTION TIMELINE │             EXECUTION GRAPH               │  EVIDENCE INSPECTOR  │
│                     │                                           │                      │
│ - Hierarchical tree │ - Directed Acyclic Graph (DAG) canvas     │ - Overview Tab       │
│ - Collapsible spans │ - Semantic node types & status markers    │ - Inputs Payload     │
│ - Depth indentation │ - 5 typed edge relationships              │ - Outputs Payload    │
│ - Suspicious badges │ - First suspicious event emphasis         │ - Errors & Stack     │
│ - Real-time search  │ - Focus Execution Path mode               │ - Ground-truth Rules │
│ - Jump to earliest  │ - Minimap, zoom, pan, fit to view (F)     │ - Redacted Raw JSON  │
│                     │                                           │                      │
└─────────────────────┴───────────────────────────────────────────┴──────────────────────┘
```

### Tri-Directional Synchronized Selection

All panels are synchronized by an event-selection engine tied directly to the URL query string (`?event=EVENT_ID`):

1. **Timeline Selection**: Clicking an event in the timeline selects the event, expands parent spans, centers and highlights the corresponding node in the graph, updates the Evidence Inspector tabs, and syncs `?event=EVENT_ID`.
2. **Graph Node Selection**: Clicking a node in the React Flow canvas selects the event, scrolls the timeline to reveal and focus the corresponding event row, and populates the Evidence Inspector.
3. **Evidence Citation Navigation**: Clicking any cited event reference in incident findings or rule detections deep-links directly into the workspace, selects the cited event, reveals its graph node, and opens the evidence tab.
4. **Browser History**: URL synchronization ensures that browser back and forward navigation gracefully restores exact event selections and path views.

---

## 2. Graph Node Types & Semantics

The execution graph represents telemetry events with dedicated visual signatures, icons, and status indicators:

| Node Type | Icon / Color | Description |
| :--- | :--- | :--- |
| `user_prompt` | Purple Compass (`#A78BFA`) | Original user instruction, constraints, and initial prompt inputs |
| `agent_plan` | Violet Compass (`#818CF8`) | Reasoning chain, thought steps, or declared plan |
| `model_call` | Blue Sparkles (`#60A5FA`) | Direct LLM / foundation model invocation |
| `tool_call` | Yellow Terminal (`#FBBF24`) | Tool invocation with structured arguments |
| `tool_result` | Green Check / Red X | Output payload, exit code, or tool response |
| `validation` | Orange Shield (`#FB923C`) | Invariant assertion, unit test check, or guardrail |
| `error` | Red Octagon (`#FB7185`) | Execution exception, fatal failure, or policy violation |
| `agent_response` | Indigo Message (`#A78BFA`) | Final agent output or completion message to the user |

### Node Annotations
- **First Suspicious Event**: Prominently marked with an amber/red glowing badge (`First Suspicious`) and flame icon indicating the earliest chronological event exhibiting anomalous telemetry.
- **Duration Badge**: Shows execution duration in milliseconds (`formatDuration`).
- **Tool Name Pill**: Distinct pill for tool executions (e.g., `delete_file`, `bash`, `write_file`).

---

## 3. Graph Edge Semantics

Unlike conventional APM tools that draw arbitrary sequence lines, RIFT distinguishes **5 strictly typed relationship edges**:

```
1. Parent-Child          [Solid Gray / Red if flagged]  Observed span hierarchy
2. Tool Execution        [Solid Indigo, 1.8px]          Explicit tool call -> result pair
3. Validation Dep        [Dashed Amber, 1.8px]          Target span -> validation check
4. Chronological Seq     [Dotted Muted Gray, 1.2px]     Observed temporal order (non-causal)
5. Suspected Cause       [Animated Dashed Rose, 2.0px]  Inferred causal link between failure & root cause
```

> **Semantics Guarantee**: Chronological sequence is **never** presented as proven causality. Inferred causal edges are explicitly labeled as `(inferred)`.

---

## 4. Execution Path Reconstruction ("Focus Path")

When diagnosing root cause in complex traces with 50–200+ nodes, engineers can activate **Focus Execution Path** (`P` hotkey or toolbar toggle):

- Automatically traverses the DAG upward through all **ancestor spans** back to the root prompt.
- Traverses downward through all direct children and **transitive descendants**.
- **Dims unrelated nodes and edges** to 15% opacity while highlighting the active execution chain.
- Cleared instantly with `Esc` or by clicking the path toggle.

---

## 5. Intent vs Execution Comparison Mode

Accessible via the view toggle in the workspace header, this mode places user expectations and actual telemetry side-by-side:

### Left: Agent Intent
- **Declared Objective**: Original user prompt and parameters.
- **Explicit Instructions & Constraints**: Extracted negative constraints (e.g., *"Do not modify src/ files"*).
- **Declared Plan**: Chronological planning steps recorded by the agent prior to tool calls.

### Right: Observed Execution
- **Destructive Operations**: Detected file deletions, overwrites, drops, or process terminations, with `PROTECTED` badges for protected paths.
- **Failed Operations & Validations**: Explicit errors, exit codes, and assertion exceptions.
- **State Drift Assessment**: Consistency check comparing planned changes against actual environment state mutations.
- **Ground-Truth Findings**: Direct links to triggered deterministic incident detection rules (`RIFT-001` through `RIFT-008`).

---

## 6. Keyboard Shortcuts

| Key | Action |
| :--- | :--- |
| `J` | Select next chronological event in timeline |
| `K` | Select previous chronological event in timeline |
| `/` | Focus search filter input in timeline |
| `F` | Fit execution graph to view canvas |
| `P` | Toggle Focus Execution Path mode |
| `Esc` | Clear path focus or close active modal / drawer |
| `?` | Open keyboard shortcuts reference modal |

*Note: Hotkeys are disabled when typing inside search inputs or code inspection viewers.*

---

## 7. Performance Considerations

- **Deterministic Dagre Layout**: Layout positions are computed in linear time $O(V + E)$ with cached coordinates.
- **Canvas Virtualization**: React Flow canvas renders only visible nodes and handles large trees (tested up to 500 nodes).
- **Client-Side DAG Traversal**: Ancestor and descendant trees are indexed using `Map<string, string[]>` for $O(1)$ child lookups and sub-millisecond path focusing.
- **Debounced Search**: Timeline search operates locally on cached span lists with zero network overhead.
- **Zero Hallucination / Zero Mocking**: Telemetry and incident citations are grounded in persisted SQLite records.

---

## 8. Known Limitations (Phase 3)

- **Manual Layout Adjustments**: Graph nodes use deterministic auto-layout (`TB`); manual drag positions are reset on re-layout.
- **Gemma Local Inference**: Root cause natural-language hypotheses and counterfactual replay are scheduled for **Phase 4** and **Phase 5**.
