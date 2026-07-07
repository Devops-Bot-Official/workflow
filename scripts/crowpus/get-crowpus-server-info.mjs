import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "node",
  args: ["./node_modules/@crowpus/mcp-cli/dist/index.js", "run"],
  stderr: "inherit",
});
const client = new Client({ name: "crowpus-server-info", version: "1.0.0" });

try {
  await client.connect(transport);
  const result = await client.callTool({ name: "mcp_server_info", arguments: {} });
  console.log(JSON.stringify({
    isError: result.isError ?? false,
    structuredContent: result.structuredContent,
    content: result.content,
  }, null, 2));
} finally {
  await client.close();
}
