/**
 * Orion Celestia Intel — MCP server, Streamable HTTP transport (stateless).
 * Serves POST /mcp for MCP clients and GET /healthz for monitoring.
 * Designed to sit behind nginx: location /mcp -> 127.0.0.1:8791.
 */
import { createServer, ServerResponse } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerTools, registerResources, registerPrompts, SERVER_INFO } from "./tools.js";

const PORT = Number(process.env.PORT ?? 8791);
const HOST = process.env.HOST ?? "127.0.0.1";

// A stray synchronous throw inside an async request handler must never take the
// whole process down; log and keep serving.
process.on("unhandledRejection", (e) => console.error("[orion-agent-kit] unhandledRejection:", e));
process.on("uncaughtException", (e) => console.error("[orion-agent-kit] uncaughtException:", e));

function setCors(res: ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, Authorization, Mcp-Session-Id, MCP-Protocol-Version");
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
}

const httpServer = createServer(async (req, res) => {
  setCors(res);
  // Only the path is needed for routing. Never build a URL from the (untrusted)
  // Host header — a malformed Host would throw and crash the request.
  const pathname = (req.url ?? "/").split("?")[0];

  if (req.method === "OPTIONS") {
    res.writeHead(204).end();
    return;
  }

  if (req.method === "GET" && (pathname === "/healthz" || pathname === "/mcp/healthz")) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, server: SERVER_INFO.name, version: SERVER_INFO.version }));
    return;
  }

  if (pathname === "/mcp" || pathname === "/") {
    if (req.method !== "POST") {
      res.writeHead(405, { "Content-Type": "application/json", Allow: "POST, OPTIONS" });
      res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed. POST JSON-RPC to this endpoint." }, id: null }));
      return;
    }
    try {
      // Fresh server+transport per request: fully stateless, safe behind a load balancer.
      // enableJsonResponse -> single application/json reply (no SSE), so nginx needs no
      // special buffering/timeout handling. The transport reads and parses the body itself
      // (correct UTF-8, JSON-parse errors become spec-compliant 400s), so we pass no body.
      // Public read-only data, so DNS-rebinding/Origin checks are intentionally left off.
      const server = new McpServer(SERVER_INFO);
      registerTools(server);
      registerResources(server);
      registerPrompts(server);
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });
      res.on("close", () => {
        transport.close();
        server.close();
      });
      await server.connect(transport);
      await transport.handleRequest(req, res);
    } catch (e) {
      console.error("[orion-agent-kit] request failed:", e);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32603, message: "Internal server error" }, id: null }));
      } else {
        res.end();
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
