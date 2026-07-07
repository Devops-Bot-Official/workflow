import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "node",
  args: ["./node_modules/@crowpus/mcp-cli/dist/index.js", "run"],
  stderr: "inherit",
});
const client = new Client({ name: "current-node-types", version: "1.0.0" });

function json(result) {
  if (result.structuredContent) return result.structuredContent;
  const raw = result.content?.find((item) => item.type === "text")?.text;
  if (!raw) return undefined;
  try { return JSON.parse(raw); } catch { return raw; }
}

try {
  await client.connect(transport);
  const summary = [];
  const categoryResult = await client.callTool({
    name: "workflow_list_node_categories",
    arguments: {},
  });
  const categoriesPayload = json(categoryResult);
  console.log("===== CATEGORIES =====");
  console.log(JSON.stringify(categoriesPayload, null, 2));

  if (typeof categoriesPayload === "string") {
    const allResult = await client.callTool({
      name: "workflow_list_node_types",
      arguments: {},
    });
    console.log("===== ALL NODE TYPES =====");
    console.log(JSON.stringify(json(allResult), null, 2));
    for (const [name, args] of [
      ["workflow_get_node_config", { type: "trigger_webhook" }],
      ["workflow_get_build_guide", { section: "building" }],
    ]) {
      const result = await client.callTool({ name, arguments: args });
      console.log(`===== CONTROL: ${name} =====`);
      console.log(JSON.stringify(json(result), null, 2));
    }
  }

  const categories = Array.isArray(categoriesPayload)
    ? categoriesPayload
    : categoriesPayload?.categories ?? categoriesPayload?.result ?? [];

  for (const item of categories) {
    const category = typeof item === "string" ? item : item.name ?? item.category;
    if (!category) continue;
    const result = await client.callTool({
      name: "workflow_list_node_types",
      arguments: { category },
    });
    console.log(`===== CATEGORY: ${category} =====`);
    const value = json(result);
    console.log(JSON.stringify(value, null, 2));
    const nodes = Array.isArray(value) ? value : value?.result ?? [];
    summary.push({ category, count: nodes.length, types: nodes.map((node) => node.type) });
  }
  console.log("===== SUMMARY =====");
  console.log(JSON.stringify({
    total: summary.reduce((sum, item) => sum + item.count, 0),
    categories: summary,
  }, null, 2));
} finally {
  await client.close();
}
