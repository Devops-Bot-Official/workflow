# Dee Empire Workflow Standard

This guide defines how to design correct Crowpus visual workflows for Dee Empire. It is derived from the working examples:

- `workflows/data_havest.json`
- `workflows/outreach.json`

Use it with `CROWPUS_WORKFLOW_FINDINGS.md`, which contains the live node catalog and MCP tool contract.

## What the examples establish

| Example | Nodes | Connections | Groups | Purpose |
|---|---:|---:|---:|---|
| `data_havest.json` | 26 | 21 | 4 | Discover, analyze, deduplicate, and store leads |
| `outreach.json` | 31 | 23 | 4 | Draft outreach, request approval, send safely, and update CRM state |

Both examples have:

- One clear webhook entry point
- Stable logical node IDs
- Left-to-right phase layout
- Valid connection and group references
- No disabled production nodes
- Scripts that normalize uncertain input
- Explicit database responsibility
- Notes explaining operations and repair steps
- Clear success, rejection, skip, or failure outcomes

## Required top-level structure

Every workflow JSON file has exactly three graph collections:

```json
{
  "nodes": [],
  "connections": [],
  "groups": []
}
```

### Node structure

```json
{
  "node_id": "node_prepare_input",
  "type": "script",
  "name": "Prepare Input",
  "description": "Validate and normalize the trigger payload.",
  "parameters": {},
  "position": { "x": 300, "y": 300 },
  "is_disabled": false
}
```

Rules:

- `node_id` must be unique, stable, descriptive, and use `snake_case`.
- Use the exact node `type` returned by the Crowpus catalog.
- Obtain the parameter schema with `workflow_get_node_config` before authoring a new type.
- Give operational nodes meaningful names and descriptions.
- Keep canvas positions intentional and generally left-to-right.
- Production nodes should explicitly set `is_disabled: false`.

### Connection structure

```json
{
  "source_node_id": "node_prepare_input",
  "target_node_id": "node_process",
  "source_handle": "output",
  "target_handle": "input"
}
```

Use these handles precisely:

- Normal flow: `output` to `input`
- Conditional: `on_true` or `on_false` to `input`
- Human approval: `approved` or `rejected` to `input`
- Interactive form: `submitted` to `input`
- AI model attachment: `ai_languageModel` on both ends
- AI tool attachment: `ai_tool` on both ends
- AI memory attachment: `ai_memory` on both ends
- AI output parser attachment: `ai_outputParser` on both ends

Every connection must reference node IDs present in `nodes`.

### Group structure

```json
{
  "name": "Phase 1 - Input And Validation",
  "description": "Receive, validate, and normalize the request.",
  "color": "#3b82f6",
  "position": { "x": 0, "y": 200 },
  "size": { "width": 1000, "height": 400 },
  "node_ids": [
    "node_trigger",
    "node_validate_input"
  ]
}
```

Groups organize the canvas but do not control execution. Every grouped ID must reference a real node.

## Dee Empire phase pattern

### Phase 1: Trigger and contract

Start with one explicit trigger, normally `trigger_webhook`, `trigger_cron`, or `start`.

Immediately validate and normalize external input with a `script` node. Do not let raw webhook fields flow directly into database queries, AI prompts, or customer-facing actions.

The normalization node should:

- Read the accepted payload shapes
- Reject missing required identifiers
- Normalize strings, lists, dates, and limits
- Return one stable internal object
- Avoid logging secrets or tokens

### Phase 2: Fetch context and prepare work

Read required database or service context before expensive AI or external calls.

Keep responsibilities separate:

- Database nodes fetch or persist records.
- Script nodes normalize, validate, parse, and transform.
- AI agents reason from prepared context.
- Tool nodes give agents narrowly defined capabilities.

Use deterministic code for validation, deduplication, IDs, SQL escaping, and state transitions. Use AI for research, analysis, drafting, classification, or extraction where uncertainty is expected.

### Phase 3: Perform the main operation

The main operation may be AI research, document generation, outreach drafting, calculation, or integration work.

For AI agents:

- Attach exactly one intended language model through `ai_languageModel` unless the node schema says otherwise.
- Attach tools through `ai_tool`, not through the normal execution chain.
- Give the agent a strict input contract and output contract.
- Request JSON-only output when downstream code expects structured data.
- Add a script parser after the agent to tolerate code fences, invalid JSON, missing fields, and unsafe characters.
- Set iteration limits appropriate to cost and task complexity.

### Phase 4: Safety gate and terminal outcomes

Any customer communication, destructive action, payment, publication, or meaningful external side effect needs an explicit gate.

The outreach example establishes the preferred pattern:

```text
Prepare exact preview
  → Notify owner
  → Human approval
      ├─ approved → validate recipient → perform action → persist success
      └─ rejected → persist rejection → notify → terminal output
```

Never place the external action on a path reachable before approval. Approval branches must use the exact `approved` and `rejected` handles.

Each possible branch needs a terminal output node such as:

- `Done: Sent`
- `Done: Rejected`
- `Done: No Recipient`
- `Done: Skipped Existing`
- `Done: Failed Safely`

## Data and database rules

Treat database boundaries as contracts rather than convenient storage.

- Identify the source table, workflow-owned table, and shared CRM table.
- Create or migrate workflow-owned tables deliberately.
- Validate IDs before querying.
- Parameterize SQL where the node supports parameters.
- If interpolation is unavoidable, normalize and escape values first.
- Use unique constraints and `ON CONFLICT` as final duplicate protection.
- Do not mark business state complete before the external action succeeds.
- Preserve audit states such as `pending_approval`, `approved`, `sent`, `rejected`, and `failed`.
- Re-read or query the affected record when verification matters.

## References between nodes

The examples reference returned fields directly:

```text
{{node_parse_draft.subject}}
{{node_loop.item.url}}
{{node_human_approval.approval_note}}
```

Do not insert an `output` layer unless the producing node actually returns one. For example, prefer `{{node_script.field}}` when the script returns `{ field: value }`, not `{{node_script.output.field}}`.

Before finalizing, verify every template reference against the producing node's real output shape.

## Notes and operator documentation

Complex workflows should contain non-executing `note` nodes for:

- Workflow purpose and operator overview
- Inputs and expected payloads
- Phase-by-phase behavior
- Database contract
- Safety and approval behavior
- Safe test order
- Common failure symptoms and repairs

Notes should explain what operators may edit and what mechanics should remain untouched.

## Minimal correct workflow skeleton

```json
{
  "nodes": [
    {
      "node_id": "node_trigger",
      "type": "trigger_webhook",
      "name": "Trigger: Webhook",
      "description": "Receive the workflow request.",
      "parameters": {
        "events": ["trigger"],
        "webhook_id": "replace_with_unique_webhook_id"
      },
      "position": { "x": 0, "y": 300 },
      "is_disabled": false
    },
    {
      "node_id": "node_validate_input",
      "type": "script",
      "name": "Validate Input",
      "description": "Validate and normalize the webhook payload.",
      "parameters": {
        "language": "javascript",
        "script": "module.exports = async function({ input }) { if (!input) throw new Error('Input is required'); return { ok: true, input }; };"
      },
      "position": { "x": 300, "y": 300 },
      "is_disabled": false
    },
    {
      "node_id": "node_done",
      "type": "set",
      "name": "Done",
      "description": "Return a stable terminal result.",
      "parameters": {
        "fields": [
          { "name": "status", "value": "completed" }
        ]
      },
      "position": { "x": 600, "y": 300 },
      "is_disabled": false
    }
  ],
  "connections": [
    {
      "source_node_id": "node_trigger",
      "target_node_id": "node_validate_input",
      "source_handle": "output",
      "target_handle": "input"
    },
    {
      "source_node_id": "node_validate_input",
      "target_node_id": "node_done",
      "source_handle": "output",
      "target_handle": "input"
    }
  ],
  "groups": [
    {
      "name": "Phase 1 - Request",
      "description": "Receive and validate the request.",
      "color": "#3b82f6",
      "position": { "x": -40, "y": 240 },
      "size": { "width": 760, "height": 220 },
      "node_ids": ["node_trigger", "node_validate_input", "node_done"]
    }
  ]
}
```

This skeleton shows graph correctness, not a production business process. Replace its node parameters only after reading each selected node's live configuration schema.

## Build procedure through MCP

1. Discover the organization and project.
2. Call `workflow_list_node_categories` and `workflow_list_node_types`.
3. Call `workflow_get_node_config` for every node type to be used.
4. Draft the graph locally with stable logical IDs.
5. Check node references, template expressions, handles, and branch coverage.
6. Create the workflow in draft status.
7. Create nodes and record their returned database UUIDs.
8. Create connections using database UUIDs, not logical node IDs.
9. Create visual groups using database UUIDs if required by the API.
10. Read the complete structure back.
11. Run workflow validation and repair every error.
12. Perform a safe test with mock or non-production data.
13. Test rejection and failure branches before success branches.
14. Publish only after explicit approval when live triggers should activate.

## Final validation checklist

- [ ] The workflow has one intentional entry point.
- [ ] Every node ID is unique and descriptive.
- [ ] Every node type exists in the current catalog.
- [ ] Every node parameter object matches its live schema.
- [ ] Every connection references real nodes.
- [ ] Every connection uses the correct handles.
- [ ] Every group references real nodes.
- [ ] Every template reference matches a real upstream field.
- [ ] External input is validated before use.
- [ ] AI output is parsed and normalized before persistence or action.
- [ ] Duplicate and idempotency behavior is defined.
- [ ] Database state changes occur in the correct order.
- [ ] External side effects have a human gate where appropriate.
- [ ] Every conditional and approval branch reaches a clear terminal state.
- [ ] Notes explain operation, editable controls, database contracts, and repair steps.
- [ ] Rejection, missing-data, duplicate, and failure paths are tested.
- [ ] `workflow_validate` returns no blocking errors.
- [ ] The workflow remains a draft until live execution is approved.
