# Codex CLI

This repo ships a `.codex/config.toml` as a template. Codex CLI reads its config from `~/.codex/config.toml`, so copy the block below there (project-level `.codex/` is not always picked up):

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
