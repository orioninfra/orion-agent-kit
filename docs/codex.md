# Codex CLI

This repo ships `.codex/config.toml`. For a global setup, add to `~/.codex/config.toml`:

```toml
[mcp_servers.orion]
command = "npx"
args = ["-y", "mcp-remote", "https://orionlabsone.cc/mcp"]
```

Codex speaks stdio to MCP servers; [`mcp-remote`](https://www.npmjs.com/package/mcp-remote) bridges it to the hosted HTTP endpoint (requires Node ≥ 20).

Self-hosted alternative:

```toml
[mcp_servers.orion]
command = "npx"
args = ["tsx", "/path/to/orion-agent-kit/src/index.ts"]
```
