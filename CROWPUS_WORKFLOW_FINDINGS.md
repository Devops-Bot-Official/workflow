# Crowpus Workflow Findings

Last verified: 2026-07-07

## Scope

This document covers Crowpus **visual automation workflows** (the n8n-like workflow system). It is distinct from **CrowFlow**, which is Crowpus's CI/CD pipeline system.

The connected Crowpus MCP server advertised 310 tools in total, including 30 tools whose names begin with `workflow_`.

## System model

```text
Organization
└── Project
    └── Workflow
        ├── Nodes
        ├── Connections
        ├── Visual groups
        └── Executions
            ├── Status and progress
            ├── Per-node logs
            └── Execution history
```

Every workflow operation is scoped to a `project_id`. Operations on an existing workflow also require its `workflow_id`.

## Recommended lifecycle

1. Discover the organization with `organization_list`.
2. Discover the project with `project_list`.
3. List existing workflows with `workflow_list`.
4. Create a draft with `workflow_create` when requested.
5. Inspect available node types before constructing the graph.
6. Create nodes and retain their returned database UUIDs.
7. Connect nodes using their database UUIDs and the correct handles.
8. Inspect the complete graph with `workflow_structure_get`.
9. Run `workflow_validate` and resolve errors.
10. Publish with `workflow_publish` only when live triggers should become active.
11. Execute with `workflow_execute`, then poll status and inspect logs.

## Workflow management tools

- `workflow_list`: List workflows in a project. Supports search, status, tag, and pagination.
- `workflow_get`: Read one workflow.
- `workflow_create`: Create a workflow using a name and optional description/tags.
- `workflow_update`: Update metadata, status, live state, or tags.
- `workflow_delete`: Soft-delete a workflow. Treat as destructive.
- `workflow_publish`: Set the workflow active and enable live triggers.
- `workflow_clone`: Deep-copy a workflow, including nodes, connections, and groups.
- `workflow_validate`: Check whether a workflow is ready to execute.

Workflow statuses are `draft`, `active`, and `archived`.

Publishing activates configured triggers such as cron, webhook, and chat triggers.

## Node tools

- `workflow_node_create`
- `workflow_node_update`
- `workflow_node_delete`
- `workflow_node_list`
- `workflow_catalog_list_nodes`
- `workflow_catalog_get_node`
- `workflow_catalog_guide`
- `workflow_node_catalog`

Before creating a node, inspect the catalog entry for its exact type and parameter schema.

### Critical ID distinction

Node creation takes a logical `node_id`, such as `trigger_1` or `node_1`.

Subsequent update, delete, and connection operations require the node's **database UUID**, returned by node creation or discovery. Do not pass the logical ID where a database UUID is expected.

Typical node types mentioned by the server include:

- `trigger_webhook`: Webhook trigger.
- `ai_agent`: AI agent node with special AI sub-node sockets.
- `set`: Assign or transform values.
- `conditional`: Branch execution using `on_true` and `on_false` outputs.
- `http_request`: Make an HTTP request.

These five types were the initial examples exposed by the MCP tool schemas. The complete catalog was subsequently retrieved successfully.

### Complete node catalog

The repaired `workflow_list_node_categories` and `workflow_list_node_types` endpoints returned 188 node types across 9 categories on 2026-07-06. A refresh on 2026-07-07 returned **189 node types**, adding `interactive_form` under Actions. Later on 2026-07-07, `html_page` was also confirmed live through `workflow_get_node_config` and runtime testing.

#### Triggers (17)

`start`, `webhook`, `trigger_webhook`, `trigger_chat`, `trigger_telegram`, `trigger_cron`, `trigger_manual_form`, `trigger_email`, `trigger_sms`, `trigger_whatsapp`, `trigger_phone_call`, `trigger_whatsapp_qr`, `trigger_calendar_event`, `trigger_mqtt`, `trigger_rss`, `trigger_cdc`, `trigger_error`

#### Actions (79)

`shell`, `http`, `database`, `email`, `github`, `script`, `crowflow`, `workflow`, `gmail`, `google_sheets`, `kanban`, `human_approval`, `interactive_form`, `html_page`, `stop_and_error`, `csv`, `slack`, `messenger`, `discord`, `stripe`, `notion`, `python`, `ssh`, `s3`, `file_helper`, `redis`, `kv`, `metric_emit`, `elasticsearch`, `opensearch`, `action_sms`, `action_whatsapp`, `action_whatsapp_qr`, `action_phone_call`, `action_stt`, `action_tts`, `ocr`, `document_extract`, `pdf_generate`, `docx_generate`, `excel_advanced`, `google_calendar`, `outlook_calendar`, `salesforce`, `hubspot`, `browser_automation`, `screenshot`, `web_scraper`, `shopify`, `woocommerce`, `shipping`, `inventory`, `quickbooks`, `xero`, `plaid`, `invoice_generate`, `currency_convert`, `twitter_x`, `linkedin`, `instagram`, `facebook_page`, `social_media_monitor`, `docusign`, `pandadoc`, `contract_analysis`, `fhir`, `medical_transcription`, `lab_results_parser`, `medication_lookup`, `appointment_booking`, `greenhouse`, `lever`, `hr_onboarding`, `payroll`, `mqtt_publish`, `websocket_client`, `pdf_render`, `storage_upload`, `storage_signed_url`

##### `interactive_form`

Category: Actions

Purpose: pause execution, display a sandboxed custom HTML form, collect user input, and then resume the workflow.

Advertised parameters:

- `title`: form heading.
- `purpose`: operator-facing explanation of why input is requested.
- `html`: custom sandboxed HTML form content.
- `submit_label`: label for the final submit/continue action.
- `allow_save`: whether the user may save without final submission.
- `save_label`: label for the save action.

The live detail endpoint exposes parameter names but not their full types, defaults, or output object. Runtime validation confirmed that the node's only valid source handle is `submitted`:

```text
interactive_form --submitted--> next_node.input
```

Do not use the normal `output` handle for this node. The exact submitted payload shape should still be inspected from a test execution before relying on individual form fields.

##### `html_page`

Category: Actions

Purpose: open a rendered custom HTML/CSS/JavaScript page inside workflow execution, keep the workflow paused while the page is open, and resume when the user closes it.

Advertised parameters:

- `title`: page heading in the Crowpus chrome.
- `purpose`: operator-facing explanation shown above the page.
- `html`: full custom rendered page content.
- `close_label`: label for the close/continue button.

Confirmed runtime behavior from 2026-07-07 testing:

- Valid connection routing is the normal handle path:

```text
html_page --output--> next_node.input
```

- The previous node payload is available to page code as `window.workflowInput`.
- After the page closes, downstream nodes receive a wrapper object containing:
  - `closed_at`
  - `page_output`
  - `page_closed_by`
- In actual executions, downstream extraction should read `page_output` first.

Confirmed backend behavior change:

- Early tests rendered correctly but always passed `page_output: {}` downstream.
- After backend changes on 2026-07-07, page output passing began working correctly.
- This means `html_page` is now suitable for real workflows that collect operator input and pass it to later nodes, including database writes.

Practical guidance:

- Use `window.workflowInput` for prefilled data.
- Set output data before closing the page so Crowpus can persist it into `page_output`.
- When building downstream script nodes, check `source.page_output` before falling back to generic payload shapes.

#### Logic (17)

`conditional`, `decision`, `loop`, `parallel_split`, `wait`, `rate_limit`, `note`, `try_catch`, `split`, `merge`, `state_machine`, `alert_on_failure`, `budget_guard`, `circuit_breaker`, `guardrails`, `llm_judge`, `semantic_cache`

#### Transformation (12)

`set`, `transform`, `aggregate`, `crypto`, `date`, `filter`, `html`, `markdown`, `random`, `sort`, `unique`, `hipaa_pii_mask`

#### AI Nodes (5)

`ai_agent`, `ai_chain_llm`, `ai_chain_qa`, `agent`, `ai_vision`

#### AI Models (14)

`lm_openai`, `lm_anthropic`, `lm_ollama`, `lm_azure`, `lm_gemini`, `lm_groq`, `lm_mistral`, `lm_deepseek`, `lm_xai`, `lm_together`, `lm_fireworks`, `lm_openrouter`, `lm_cohere`, `lm_openai_compat`

#### AI Tools (32)

`tool_calculator`, `tool_http`, `tool_node_proxy`, `tool_workflow`, `tool_web_fetch`, `tool_web_search`, `tool_database`, `tool_sql_describe`, `tool_upsert`, `tool_dedupe`, `tool_profile`, `tool_validate`, `tool_telegram`, `tool_mastodon`, `tool_bluesky`, `tool_messenger`, `tool_github_pr`, `tool_github_issue`, `tool_vector_search`, `tool_memory`, `tool_human_in_the_loop`, `tool_mcp`, `tool_send_email`, `tool_sms`, `tool_whatsapp`, `tool_phone_call`, `tool_calendar`, `tool_crm`, `tool_workflow_builder`, `tool_project_management`, `tool_ecommerce`, `tool_finance`

#### AI Memory & Parsing (4)

`mem_buffer_window`, `mem_postgres`, `parser_structured`, `mem_per_user`

#### AI RAG (10)

`ai_vector_store_insert`, `ai_vector_store_query`, `emb_openai`, `vs_pgvector`, `splitter_recursive`, `loader_text`, `loader_url`, `loader_pdf`, `loader_docx`, `loader_excel`

The category listing is suitable for discovery. Before constructing a specific node, call `workflow_get_node_config` with its exact type to retrieve required parameters, project-setting prerequisites, and connection details.

### Node catalog retrieval status

**Current status: resolved.** The category and node-type listing endpoints now work. The notes below preserve the earlier failure history because it may help diagnose regressions.

Retested after the 2026-07-06 server update. The server now advertises renamed catalog tools:

- `workflow_list_node_categories`
- `workflow_list_node_types`
- `workflow_get_node_config`
- `workflow_get_build_guide`
- `workflow_node_catalog`

The former `workflow_catalog_list_nodes` name now correctly returns `Unknown tool`, confirming that the deployment changed. However, calls to all four replacement discovery/detail tools still return only `Error calling tool '<tool_name>'`. Both categorized and unfiltered `workflow_list_node_types` calls were tested. The MCP bridge connects normally and `tools/list` reports 310 total tools, so the remaining failure is inside the workflow catalog handlers or their authorization path.

`mcp_server_info` was then called successfully. Its current recommended agent flow explicitly says to use `workflow_list_node_categories`, `workflow_list_node_types`, and `workflow_get_node_config` for visual workflow graph building. This confirms that the replacement tool names and our call sequence are correct. The same server-info response explains that token scopes are checked before backend calls, but the catalog errors do not expose a missing scope, HTTP status, or error category, so they still cannot be classified conclusively as authorization versus backend failure.

As a control test, the same token, CLI bridge, and MCP client successfully called `kanban_board_list` and returned live boards. A subsequent fresh-session retry of all four workflow catalog endpoints produced the same generic errors. This rules out a generally broken token, bridge, MCP transport, or stale client session and isolates the problem to the visual-workflow tool family or its specific token scopes.

The following read-only catalog calls were tested through the live MCP bridge:

- `workflow_catalog_list_nodes({})`
- `workflow_node_catalog({project_id})`
- `workflow_catalog_guide({section: "building"})`
- `workflow_catalog_guide({section: "handles"})`

All returned an MCP error containing only `Error calling tool '<tool_name>'`, without a status code, permission name, or backend explanation.

The project-scoped catalog was tested against all three currently visible projects:

- `Devops`
- `CrowPus Marketing`
- `Dee-Empire Project`

Organization and project discovery succeeded, confirming that the token and bridge are working. `workflow_list` also returned the same generic error for every visible project. Therefore, the problem affects the visual-workflow API family rather than project discovery alone.

Likely explanations are a missing workflow permission on the MCP token or a Crowpus backend routing/implementation error. The generic response is insufficient to distinguish them. Check the token's visual-workflow read scope in the Crowpus token settings before retrying. If the permission is already enabled, report the failing workflow tools to Crowpus with the test date and project context.

Until the endpoint succeeds, do not invent or infer a complete node list. Re-run `scripts/crowpus/fetch-crowpus-node-catalog.mjs` after permissions or backend behavior change.

Nodes may have:

- Type-specific parameters
- Canvas position `{x, y}`
- Disabled state
- Pinned mock output for testing

## Connections and routing

- `workflow_connection_create`: Connect two node UUIDs.
- `workflow_connection_delete`: Delete a connection by connection UUID.
- `workflow_structure_get`: Read the complete graph with nodes, connections, and groups.

Default connection routing is:

```text
source_handle: output
target_handle: input
```

Special source handles include:

- `on_true` and `on_false` for conditionals
- `approved` and `rejected` for approval nodes

AI socket handles include:

- `ai_languageModel`
- `ai_tool`
- `ai_memory`
- `ai_outputParser`

For AI sub-node connections, both source and target handles may need the AI socket name. Confirm the live node schema and connection guide before wiring AI graphs.

## Visual groups

- `workflow_group_create`
- `workflow_group_update`
- `workflow_group_delete`
- `workflow_group_list`

Groups organize nodes visually using a name, description, color, position, and size. Deleting a group removes the visual boundary, not the contained nodes.

## Validation

`workflow_validate` performs readiness checks including:

- Missing required parameters
- Orphan nodes
- Invalid connections
- Circular dependencies
- Disabled nodes

Validation returns issues with error or warning severity and a summary. Validate before publishing or execution.

## Execution tools

- `workflow_execute`: Start an execution.
- `workflow_execution_get`: Read full execution details and results.
- `workflow_execution_status`: Poll real-time status and progress.
- `workflow_execution_history`: List previous executions.
- `workflow_execution_logs`: Read detailed per-node logs.
- `workflow_execution_cancel`: Cancel queued, running, prepared, or paused work.
- `workflow_execution_rerun`: Resume a failed or cancelled execution from its failure point.

Execution options include:

- JSON `input_data` passed to the trigger
- Optional execution name
- Automatic start (`auto_run`, default `true`)
- Parallel execution of independent nodes
- Timeout up to 3600 seconds
- Step-through debug mode

Execution statuses include `running`, `completed`, `failed`, `cancelled`, and `partial_failure`.

A rerun preserves successful node outputs and runs failed/skipped nodes plus downstream dependents.

## Permissions and safety

Crowpus MCP tokens carry explicit scopes. The MCP server checks token scopes first; the Crowpus backend then checks organization membership, roles, account tier, and token balance.

Operating rules:

- Prefer read-only discovery while planning.
- Verify the target project and workflow before writes.
- Do not publish or execute merely while exploring.
- Require explicit current-conversation confirmation for destructive operations.
- After writes, read the affected resource again to verify final state.
- Never print, log, or commit a `crow_mcp_...` token.

Common error categories include permission denial, billing/quota restrictions, missing resources, conflicts, validation errors, and backend unavailability. Do not blindly retry permission, tier, or balance errors.

## Local inspection utilities

- `scripts/crowpus/list-crowpus-tools.mjs`: Connects through the local CLI bridge and lists the advertised MCP tools.
- `scripts/crowpus/inspect-crowpus-workflows.mjs`: Reads workflow schemas and Crowpus server metadata.
- `scripts/crowpus/fetch-crowpus-node-catalog.mjs`: Discovers visible projects and attempts both global and project-scoped node catalog retrieval, plus read-only workflow discovery.
- `scripts/crowpus/list-current-workflow-tools.mjs`: Lists the workflow-related tools currently advertised by the server.
- `scripts/crowpus/fetch-current-node-types.mjs`: Retrieves node categories and produces an exact categorized node-type summary.
- `scripts/crowpus/get-crowpus-server-info.mjs`: Reads the current MCP server contract and recommended agent flow.
- `scripts/crowpus/inspect-crowpus-kanban.mjs`: Lists Kanban tools and performs read-only board discovery.

The compiled bridge currently runs with:

```powershell
node .\node_modules\@crowpus\mcp-cli\dist\index.js run
```

The upstream GitHub package did not initially include `dist/index.js`, so it was compiled locally. A direct `crowpus-mcp` shell command may remain unavailable unless npm creates a binary shim or the package is installed/linkable in a form that includes its compiled entry point.

## Open questions for deeper investigation

- Which catalog nodes require project settings, credentials, paid tier features, or external integrations?
- Which workflow MCP scopes are present on the current token?
- What workflows already exist in the user's project?
- What exact parameter schemas apply to the intended trigger and action nodes?
- How does expression/data mapping work between node outputs and downstream inputs?
- What are the retry, rate-limit, credential, and timeout semantics per node type?
- How does debug-mode continuation work after each pause?
- Which triggers require the workflow to be published versus merely active/live?

The catalog guide, node-list, project node-catalog, and workflow-list calls initially returned generic tool errors even though their schemas were advertised. The repaired category and node-type endpoints now work and returned the complete 188-type catalog above. Project-specific workflow calls should still be verified independently before relying on them.
