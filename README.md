<div align="center">

# Orion Agent Kit

**Celestia network intelligence for AI agents.** An MCP server over [Orion](https://orionlabsone.cc/celestia)'s daily analysis: anomaly signals, network verdicts, and staking &amp; DA metrics, each figure linked back to the source it came from.

[![MCP](https://img.shields.io/badge/MCP-server-6E56CF)](https://modelcontextprotocol.io)
[![Celestia](https://img.shields.io/badge/Celestia-mainnet-7B2BF9)](https://celestia.org)
[![Node](https://img.shields.io/badge/Node-%E2%89%A520-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)

</div>

---

## What this is

Orion watches Celestia mainnet continuously and publishes a daily machine-written brief: what moved, what drifted from baseline, and why it matters. This kit exposes that analysis to AI agents over the [Model Context Protocol](https://modelcontextprotocol.io).

Think of it as an analysis layer for the Celestia agent ecosystem. It sits alongside knowledge bases like Blobpedia (which answer "what is CIP-21?") and raw-data or transaction kits like Mammoblocks (which list blobs or build a delegate tx). Orion answers a different question: **what is happening on the network right now, and is it normal?**

The server is **read-only**. There are no wallets, keys, or transactions anywhere in it.

## Tools

| Tool | Question it answers |
|---|---|
| `get_daily_brief` | What's happening on Celestia today? |
| `get_signals` | Any anomalies (info / notable / critical) today or on date X? |
| `get_network_state` | Current height, DA volume, validators, staking ratios, Nakamoto coefficient, TIA price |
| `list_reports` | What daily reports exist in the archive? |
| `get_report` | Full report for a given date |
| `search_reports` | When did the archive last mention "eclipse" or "block time"? |

Each metric comes with a `provenance` link to the Celenium or LCD endpoint it was read from, so the agent can cite its sources and so can you.

## Quick start — hosted endpoint (no install)

The MCP server runs at **`https://orionlabsone.cc/mcp`**.

**Claude Code**

```bash
claude mcp add --transport http orion https://orionlabsone.cc/mcp
```

**Cursor** — add to `.cursor/mcp.json` (already included if you cloned this repo):

```json
{ "mcpServers": { "orion": { "url": "https://orionlabsone.cc/mcp" } } }
```

**VS Code** — add to `.vscode/mcp.json`:

```json
{ "servers": { "orion": { "type": "http", "url": "https://orionlabsone.cc/mcp" } } }
```

**Claude Desktop / Codex / Windsurf / Cline / any stdio-only client** — bridge with [`mcp-remote`](https://www.npmjs.com/package/mcp-remote):

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

Per-client walkthroughs: [Claude Code](docs/claude-code.md) · [Claude Desktop](docs/claude-desktop.md) · [Cursor](docs/cursor.md) · [Codex](docs/codex.md) · [VS Code](docs/vscode.md)

## Quick start — clone &amp; chat

```bash
git clone https://github.com/orioninfra/orion-agent-kit
cd orion-agent-kit
npm install
claude   # Claude Code picks up .mcp.json automatically
```

Then just ask:

> "Any anomalies on Celestia today?" · "How concentrated is the validator set?" · "When did the archive last flag block time?"

The bundled `/brief` and `/signals` commands wrap the two most common queries.

## Run the server yourself

```bash
npm install
npm run start          # Streamable HTTP on 127.0.0.1:8791/mcp
npm run start:stdio    # stdio transport (for local MCP clients)
npm run smoke          # end-to-end check of all 6 tools against the live API
```

Environment: `PORT` (default `8791`), `HOST` (default `127.0.0.1`), `ORION_API_BASE` (default `https://orionlabsone.cc`).

## REST, without MCP

The underlying API is plain JSON, usable directly or via function calling with the [OpenAPI spec](https://orionlabsone.cc/openapi.json):

| Endpoint | Returns |
|---|---|
| `GET /api/latest` | today's full report |
| `GET /api/reports` | archive index |
| `GET /api/reports/{date}` | full report for a date |
| `GET /api/rss` | the brief as an RSS feed |

## How it fits together

```
AI agent (Claude / GPT / any MCP client)
   │  MCP — 6 read-only analysis tools
   ▼
orion-agent-kit  ──►  Orion daily analysis (orionlabsone.cc/api)
                          │  every figure linked to its source
                          ▼
                      Celenium API · Celestia LCD · market data
```

## License

[Apache-2.0](./LICENSE), Copyright 2026 Orion Labs. Questions, ideas, or a tool you wish existed: open an issue.
