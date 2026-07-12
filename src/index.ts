/**
 * Orion Celestia Intel — MCP server, stdio transport.
 * Run locally: npx tsx src/index.ts   (or via any MCP client's command config)
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools, registerResources, registerPrompts, SERVER_INFO } from "./tools.js";

const server = new McpServer(SERVER_INFO);
registerTools(server);
registerResources(server);
registerPrompts(server);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`[orion-agent-kit] ${SERVER_INFO.name} v${SERVER_INFO.version} ready on stdio`);
