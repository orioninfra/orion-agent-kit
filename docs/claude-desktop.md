# Claude Desktop

Claude Desktop config lives at:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

Add the server via the [`mcp-remote`](https://www.npmjs.com/package/mcp-remote) bridge (requires Node ≥ 20):

```json
{
  "mcpServers": {
    "orion": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://orionlabsone.cc/mcp"]
    }
  }
}
```

Restart Claude Desktop — the `orion` tools appear in the tools menu.

Self-hosted alternative (no bridge):

```json
{
  "mcpServers": {
    "orion": {
      "command": "npx",
      "args": ["tsx", "/path/to/orion-agent-kit/src/index.ts"]
    }
  }
}
```
