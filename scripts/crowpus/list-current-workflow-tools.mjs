import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "node",
  args: ["./node_modules/@crowpus/mcp-cli/dist/index.js", "run"],
  stderr: "inherit",
});
const client = new Client({ name: "current-workflow-tools", version: "1.0.0" });

try {
  await client.connect(transport);
  const { tools } = await client.listTools();
  const selected = tools.filter((tool) =>
    tool.name.includes("workflow") || tool.name.includes("node_catalog") || tool.name.includes("catalog")
  );
  console.log(JSON.stringify(selected.map(({ name, description, inputSchema }) => ({
    name, description, inputSchema,
  })), null, 2));
  console.error(`MATCHING_TOOLS=${selected.length}; ALL_TOOLS=${tools.length}`);
} finally {
  await client.close();
}
