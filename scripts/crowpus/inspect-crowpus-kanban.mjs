import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "node",
  args: ["./node_modules/@crowpus/mcp-cli/dist/index.js", "run"],
  stderr: "inherit",
});
const client = new Client({ name: "crowpus-kanban-inspector", version: "1.0.0" });

function compactResult(result) {
  return {
    isError: result.isError ?? false,
    structuredContent: result.structuredContent,
    content: result.content,
  };
}

try {
  await client.connect(transport);
  const { tools } = await client.listTools();
  const kanban = tools.filter((tool) => tool.name.startsWith("kanban_"));

  console.log("===== KANBAN TOOLS =====");
  console.log(JSON.stringify(kanban.map(({ name, description, inputSchema }) => ({
    name, description, inputSchema,
  })), null, 2));
  console.error(`KANBAN_TOOL_COUNT=${kanban.length}`);

  const boardList = kanban.find((tool) => tool.name === "kanban_board_list");
  if (boardList) {
    const organizationsResult = await client.callTool({
      name: "organization_list",
      arguments: { limit: 100 },
    });
    const organizations = organizationsResult.structuredContent?.organizations ?? [];
    for (const organization of organizations) {
      console.log(`===== READ-ONLY TEST: ${boardList.name} / ${organization.name} =====`);
      console.log(JSON.stringify(compactResult(await client.callTool({
        name: boardList.name,
        arguments: { org_id: organization.id },
      })), null, 2));
    }
  }
} finally {
  await client.close();
}
