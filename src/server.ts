/**
 * Orion Celestia Intel — MCP server, Streamable HTTP transport (stateless).
 * Serves POST /mcp for MCP clients and GET /healthz for monitoring.
 * Designed to sit behind nginx: location /mcp -> 127.0.0.1:8791.
 */
import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerTools, SERVER_INFO } from "./tools.js";

const PORT = Number(process.env.PORT ?? 8791);
const HOST = process.env.HOST ?? "127.0.0.1";

function setCors(res: ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, Authorization, Mcp-Session-Id, MCP-Protocol-Version");
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

const httpServer = createServer(async (req, res) => {
  setCors(res);
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204).end();
    return;
  }

  if (req.method === "GET" && (url.pathname === "/healthz" || url.pathname === "/mcp/healthz")) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, server: SERVER_INFO.name, version: SERVER_INFO.version }));
    return;
  }

  if (url.pathname === "/mcp" || url.pathname === "/") {
    if (req.method !== "POST") {
      // Stateless mode: no SSE stream to resume, no session to delete.
      res.writeHead(405, { "Content-Type": "application/json", Allow: "POST, OPTIONS" });
      res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed. POST JSON-RPC to this endpoint." }, id: null }));
      return;
    }
    try {
      const raw = await readBody(req);
      let body: unknown;
      try {
        body = raw ? JSON.parse(raw) : undefined;
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32700, message: "Parse error" }, id: null }));
        return;
      }
      // Fresh server+transport per request: fully stateless, safe behind a load balancer.
      const server = new McpServer(SERVER_INFO);
      registerTools(server);
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      res.on("close", () => {
        transport.close();
        server.close();
      });
      await server.connect(transport);
      await transport.handleRequest(req, res, body);
    } catch (e) {
      console.error("[orion-agent-kit] request failed:", e);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32603, message: "Internal server error" }, id: null }));
      }
    }
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found. MCP endpoint: POST /mcp" }));
});

httpServer.listen(PORT, HOST, () => {
  console.error(`[orion-agent-kit] ${SERVER_INFO.name} v${SERVER_INFO.version} listening on http://${HOST}:${PORT}/mcp`);
});
