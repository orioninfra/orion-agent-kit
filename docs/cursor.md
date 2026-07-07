# Cursor

Project-level: this repo already ships `.cursor/mcp.json` — open the folder in Cursor and approve the server.

Global: **Cursor Settings → MCP → Add new global MCP server**, or edit `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "orion": {
      "url": "https://orionlabsone.cc/mcp"
    }
  }
}
```

Then ask the agent: *"Use orion to check today's Celestia signals."*
