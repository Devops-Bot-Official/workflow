import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const type = process.argv[2];
if (!type) {
  console.error("Usage: node scripts/crowpus/get-node-config.mjs <node_type>");
  process.exit(2);
}

const transport = new StdioClientTransport({
  command: "node",
  args: ["./node_modules/@crowpus/mcp-cli/dist/index.js", "run"],
  stderr: "inherit",
});
const client = new Client({ name: "crowpus-node-config", version: "1.0.0" });

try {
  await client.connect(transport);
  const result = await client.callTool({
    name: "workflow_get_node_config",
    arguments: { type },
  });
  console.log(JSON.stringify({
    isError: result.isError ?? false,
    structuredContent: result.structuredContent,
    content: result.content,
  }, null, 2));
} finally {
  await client.close();
}
