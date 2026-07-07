import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "node",
  args: ["./node_modules/@crowpus/mcp-cli/dist/index.js", "run"],
  stderr: "inherit",
});
const client = new Client({ name: "crowpus-node-catalog", version: "1.0.0" });

function payload(result) {
  return {
    isError: result.isError ?? false,
    structuredContent: result.structuredContent,
    content: result.content,
  };
}

async function call(name, args = {}) {
  const result = await client.callTool({ name, arguments: args });
  console.log(`\n===== ${name} =====`);
  console.log(JSON.stringify(payload(result), null, 2));
  return result;
}

function parseJsonText(result) {
  const value = result.content?.find((item) => item.type === "text")?.text;
  if (!value) return undefined;
  try { return JSON.parse(value); } catch { return undefined; }
}

try {
  await client.connect(transport);

  await call("workflow_catalog_list_nodes", {});

  const organizationsResult = await call("organization_list", { limit: 100 });
  const organizations = parseJsonText(organizationsResult)?.organizations ?? [];

  for (const organization of organizations) {
    const orgId = organization.id ?? organization.org_id;
    if (!orgId) continue;
    const projectsResult = await call("project_list", { org_id: orgId, limit: 100 });
    const projects = parseJsonText(projectsResult)?.projects ?? [];
    for (const project of projects) {
      const projectId = project.id ?? project.project_id;
      if (!projectId) continue;
      await call("workflow_node_catalog", { project_id: projectId });
      const workflowsResult = await call("workflow_list", { project_id: projectId, limit: 200 });
      const workflows = parseJsonText(workflowsResult)?.workflows ?? [];
      for (const workflow of workflows) {
        const workflowId = workflow.id ?? workflow.workflow_id;
        if (workflowId) await call("workflow_structure_get", {
          project_id: projectId,
          workflow_id: workflowId,
        });
      }
    }
  }
} finally {
  await client.close();
}
