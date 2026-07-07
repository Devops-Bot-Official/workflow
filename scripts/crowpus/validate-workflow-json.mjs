import fs from "node:fs";
import path from "node:path";

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("Usage: node scripts/crowpus/validate-workflow-json.mjs <workflow.json> [...]");
  process.exit(2);
}

let failed = false;

for (const file of files) {
  const errors = [];
  const warnings = [];
  let workflow;

  try {
    workflow = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    console.error(`${file}: invalid JSON or unreadable file: ${error.message}`);
    failed = true;
    continue;
  }

  const nodes = Array.isArray(workflow.nodes) ? workflow.nodes : [];
  const connections = Array.isArray(workflow.connections) ? workflow.connections : [];
  const groups = Array.isArray(workflow.groups) ? workflow.groups : [];

  if (!Array.isArray(workflow.nodes)) errors.push("Top-level nodes must be an array.");
  if (!Array.isArray(workflow.connections)) errors.push("Top-level connections must be an array.");
  if (!Array.isArray(workflow.groups)) errors.push("Top-level groups must be an array.");

  const idCounts = new Map();
  for (const [index, node] of nodes.entries()) {
    const label = `nodes[${index}]`;
    if (!node?.node_id || typeof node.node_id !== "string") errors.push(`${label} has no string node_id.`);
    if (!node?.type || typeof node.type !== "string") errors.push(`${label} has no string type.`);
    if (!node?.name || typeof node.name !== "string") warnings.push(`${label} has no display name.`);
    if (!node?.position || !Number.isFinite(node.position.x) || !Number.isFinite(node.position.y)) {
      errors.push(`${label} has an invalid position.`);
    }
    if (typeof node?.is_disabled !== "boolean") warnings.push(`${label} does not explicitly set is_disabled.`);
    if (node?.type === "script" && typeof node?.parameters?.script === "string") {
      try {
        new Function(node.parameters.script);
      } catch (error) {
        errors.push(`${label} contains invalid JavaScript: ${error.message}`);
      }
    }
    if (node?.node_id) idCounts.set(node.node_id, (idCounts.get(node.node_id) ?? 0) + 1);
  }

  for (const [id, count] of idCounts) {
    if (count > 1) errors.push(`Duplicate node_id '${id}' appears ${count} times.`);
  }

  const ids = new Set(idCounts.keys());
  const allowedSourceHandles = new Set([
    "output", "on_true", "on_false", "approved", "rejected",
    "submitted",
    "ai_languageModel", "ai_tool", "ai_memory", "ai_outputParser",
    "on_pass", "on_fail", "hit", "miss",
  ]);

  for (const [index, connection] of connections.entries()) {
    const label = `connections[${index}]`;
    if (!ids.has(connection?.source_node_id)) errors.push(`${label} has unknown source '${connection?.source_node_id}'.`);
    if (!ids.has(connection?.target_node_id)) errors.push(`${label} has unknown target '${connection?.target_node_id}'.`);
    if (!connection?.source_handle || typeof connection.source_handle !== "string") {
      errors.push(`${label} has no string source_handle.`);
    } else if (!allowedSourceHandles.has(connection.source_handle)) {
      warnings.push(`${label} uses uncommon source_handle '${connection.source_handle}'; verify it against the live node schema.`);
    }
    if (!connection?.target_handle || typeof connection.target_handle !== "string") {
      errors.push(`${label} has no string target_handle.`);
    }
  }

  for (const [index, group] of groups.entries()) {
    const label = `groups[${index}]`;
    if (!group?.name || typeof group.name !== "string") warnings.push(`${label} has no name.`);
    if (!Array.isArray(group?.node_ids)) {
      errors.push(`${label} node_ids must be an array.`);
      continue;
    }
    for (const nodeId of group.node_ids) {
      if (!ids.has(nodeId)) errors.push(`${label} references unknown node '${nodeId}'.`);
    }
  }

  const incoming = new Map([...ids].map((id) => [id, 0]));
  const outgoing = new Map([...ids].map((id) => [id, 0]));
  for (const connection of connections) {
    if (incoming.has(connection.target_node_id)) incoming.set(connection.target_node_id, incoming.get(connection.target_node_id) + 1);
    if (outgoing.has(connection.source_node_id)) outgoing.set(connection.source_node_id, outgoing.get(connection.source_node_id) + 1);
  }

  for (const node of nodes) {
    if (node.type === "note" || node.type.startsWith("lm_") || node.type.startsWith("tool_") || node.type.startsWith("mem_")) continue;
    if (!node.type.startsWith("trigger_") && node.type !== "start" && incoming.get(node.node_id) === 0) {
      warnings.push(`Executable node '${node.node_id}' has no incoming connection.`);
    }
    if (outgoing.get(node.node_id) === 0 && node.type !== "set") {
      warnings.push(`Executable node '${node.node_id}' has no outgoing connection; verify it is intentionally terminal.`);
    }
  }

  console.log(`${path.normalize(file)}: ${nodes.length} nodes, ${connections.length} connections, ${groups.length} groups`);
  for (const warning of warnings) console.log(`  WARN: ${warning}`);
  for (const error of errors) console.error(`  ERROR: ${error}`);
  console.log(errors.length === 0 ? "  PASS" : `  FAIL (${errors.length} errors)`);
  if (errors.length > 0) failed = true;
}

process.exitCode = failed ? 1 : 0;
