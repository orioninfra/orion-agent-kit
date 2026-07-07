# VS Code (GitHub Copilot agent mode)

Add to `.vscode/mcp.json` in your workspace (or via **Command Palette → MCP: Add Server**):

```json
{
  "servers": {
    "orion": {
      "type": "http",
      "url": "https://orionlabsone.cc/mcp"
    }
  }
}
```

Requires VS Code 1.99+ with MCP support enabled. The `orion` tools become available to Copilot in agent mode.
