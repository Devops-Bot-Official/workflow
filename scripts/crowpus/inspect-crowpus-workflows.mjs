import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "node",
  args: ["./node_modules/@crowpus/mcp-cli/dist/index.js", "run"],
  stderr: "inherit",
});
const client = new Client({ name: "crowpus-workflow-inspector", version: "1.0.0" });

const text = (result) => result.content
  ?.filter((item) => item.type === "text")
  .map((item) => item.text)
  .join("\n") ?? "";

try {
  await client.connect(transport);
  const catalog = await client.listTools();
  const workflowTools = catalog.tools.filter((tool) => tool.name.startsWith("workflow_"));
  console.log(`\n===== WORKFLOW TOOL SCHEMAS (${workflowTools.length}) =====`);
  for (const tool of workflowTools) {
    console.log(JSON.stringify({ name: tool.name, inputSchema: tool.inputSchema }));
  }
  for (const [name, args] of [
    ["mcp_server_info", {}],
    ["mcp_list_tool_groups", {}],
    ["workflow_catalog_guide", { section: "building" }],
    ["workflow_catalog_guide", { section: "handles" }],
    ["workflow_catalog_list_nodes", {}],
  ]) {
    const result = await client.callTool({ name, arguments: args });
    console.log(`\n===== ${name} =====\n${text(result)}`);
  }
} finally {
  await client.close();
}
