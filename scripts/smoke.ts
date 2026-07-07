/**
 * Smoke test: connects to the MCP server and exercises every tool against the live Orion API.
 *   HTTP  : npx tsx scripts/smoke.ts             (expects server on http://127.0.0.1:8791/mcp or $MCP_URL)
 *   stdio : npx tsx scripts/smoke.ts --stdio     (spawns src/index.ts itself)
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const useStdio = process.argv.includes("--stdio");
const url = process.env.MCP_URL ?? "http://127.0.0.1:8791/mcp";

function firstText(result: { content?: { type: string; text?: string }[] }): string {
  const t = result.content?.find((c) => c.type === "text")?.text ?? "";
  return t.length > 500 ? t.slice(0, 500) + " …[truncated]" : t;
}

const client = new Client({ name: "orion-smoke", version: "1.0.0" });
const transport = useStdio
  ? new StdioClientTransport({ command: "npx", args: ["tsx", "src/index.ts"] })
  : new StreamableHTTPClientTransport(new URL(url));

await client.connect(transport);
console.log(`✔ connected (${useStdio ? "stdio" : url})`);

const { tools } = await client.listTools();
console.log(`✔ tools/list → ${tools.length} tools: ${tools.map((t) => t.name).join(", ")}`);
if (tools.length !== 6) throw new Error(`expected 6 tools, got ${tools.length}`);

const checks: [string, Record<string, unknown>][] = [
  ["get_daily_brief", {}],
  ["get_network_state", {}],
  ["list_reports", { limit: 5 }],
  ["get_report", { date: "2026-07-06" }],
  ["get_signals", { min_severity: "info" }],
  ["search_reports", { query: "eclipse", limit: 7 }],
];

for (const [name, args] of checks) {
  const res = (await client.callTool({ name, arguments: args })) as {
    isError?: boolean;
    content?: { type: string; text?: string }[];
  };
  if (res.isError) throw new Error(`${name} returned error: ${firstText(res)}`);
  const text = firstText(res);
  if (!text || text === "{}") throw new Error(`${name} returned empty payload`);
  console.log(`✔ ${name}(${JSON.stringify(args)}) → ${text.split("\n").slice(0, 3).join(" ").slice(0, 160)}…`);
}

// Honest-error check: date outside the archive must fail loudly, not invent data.
const bad = (await client.callTool({ name: "get_report", arguments: { date: "2020-01-01" } })) as {
  isError?: boolean;
  content?: { type: string; text?: string }[];
};
if (!bad.isError) throw new Error("get_report(2020-01-01) should be an error");
console.log(`✔ get_report(2020-01-01) → honest error: ${firstText(bad).slice(0, 120)}`);

await client.close();
console.log("SMOKE OK");
