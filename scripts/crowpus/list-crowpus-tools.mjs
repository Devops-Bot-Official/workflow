import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "node",
  args: ["./node_modules/@crowpus/mcp-cli/dist/index.js", "run"],
  stderr: "inherit",
});

const client = new Client({ name: "crowpus-tool-check", version: "1.0.0" });

try {
  await client.connect(transport);
  const result = await client.listTools();
  console.log(JSON.stringify(result.tools.map(({ name, description }) => ({ name, description })), null, 2));
  console.error(`TOOL_COUNT=${result.tools.length}`);
} finally {
  await client.close();
}
