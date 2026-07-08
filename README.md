<div align="center">

# Orion Agent Kit

**Celestia network intelligence for AI agents.** An MCP server over [Orion](https://orionlabsone.cc/celestia)'s daily analysis: anomaly signals, network verdicts, staking &amp; DA metrics, live namespace and validator drill-downs — each figure linked back to the source it came from.

[![MCP](https://img.shields.io/badge/MCP-server-6E56CF)](https://modelcontextprotocol.io)
[![Celestia](https://img.shields.io/badge/Celestia-mainnet-7B2BF9)](https://celestia.org)
[![Node](https://img.shields.io/badge/Node-%E2%89%A520-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)

`https://orionlabsone.cc/mcp`

</div>

---

## What this is

Orion watches Celestia mainnet continuously and publishes a daily machine-written brief: what moved, what drifted from baseline, and why it matters. This kit exposes that analysis to AI agents over the [Model Context Protocol](https://modelcontextprotocol.io).

Think of it as an **analysis layer** for the Celestia agent ecosystem. It sits alongside knowledge bases (which answer "what is CIP-21?") and raw-data or transaction kits (which list blobs or build a delegate tx). Orion answers a different question: **what is happening on the network right now, is it normal, and how did we get here?**

Every number the server returns carries a `provenance` link to the Celenium or Celestia LCD endpoint it was read from, so the agent can cite its sources — and so can you. The server is **read-only**: no wallets, keys, or transactions anywhere in it.

## Tools

**Today &amp; anomalies**

| Tool | Question it answers |
|---|---|
| `get_daily_brief` | What's happening on Celestia today? (set `include_narrative` for Orion's written prose) |
| `get_signals` | Any anomalies (info / notable / critical) today or on date X? |
| `get_network_state` | Current height, DA volume, validators, staking ratios, Nakamoto coefficient, TIA price |

**Trends &amp; history**

| Tool | Question it answers |
|---|---|
| `get_trends` | What changed since yesterday / last week? (day- and week-over-week deltas) |
| `get_metric_history` | Chart one metric (fees, blobs, price, staking ratio…) over N days |
| `list_reports` | What daily reports exist in the archive? |
| `get_report` | Full report for a given date |
| `search_reports` | When did the archive last mention "eclipse" or "block time"? |

**Live drill-down** (straight from Celenium)

| Tool | Question it answers |
|---|---|
| `get_top_namespaces` | Which rollups post the most data to Celestia right now? |
| `get_namespace` | Detail for one namespace: size, blob count, last activity |
| `get_top_validators` | Largest validators by stake — moniker, commission, jailed status |

## Resources &amp; prompts

Beyond tools, the server exposes MCP **resources** an agent can read or subscribe to:

- `orion://latest` — the most recent daily report
- `orion://reports` — the archive index
- `orion://report/{date}` — any archived report by date

…and ready-made **prompts** to guide an agent:

- `daily_celestia_briefing` — produce a grounded, source-cited daily briefing
- `rollup_da_check` — survey who dominates blobspace and the current DA cost context

## What counts as a signal

Orion's detectors are **event-driven, not state-driven** — a persistently dominant namespace or a steady utilization day produces *no* signal, so what you see is what actually changed:

- **DA utilization &amp; fees** — per-block volume and fees over the last day vs the recent daily baseline
- **Blob-volume z-score** — statistical spikes/drops in data posted
- **Namespace shift** — only when the DA leader changes or its share moves materially
- **Staking &amp; concentration** — bonded-ratio moves, Nakamoto-coefficient changes, new jailings
- **Market &amp; protocol** — notable TIA price moves, active governance proposals, new celestia-app releases

Each daily brief is written by an LLM narrator and passes an automated **citation check** — every number in the prose is verified against the structured data before publishing.

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

> "Any anomalies on Celestia today?" · "What changed on Celestia since yesterday?" · "Which rollups post the most data right now?" · "How concentrated is the validator set?" · "When did the archive last flag block time?"

The bundled `/brief` and `/signals` commands wrap the two most common queries.

## Run the server yourself

```bash
npm install
npm run start          # Streamable HTTP on 127.0.0.1:8791/mcp
npm run start:stdio    # stdio transport (for local MCP clients)
npm run smoke          # end-to-end check of the tools against the live API
npm run typecheck      # type-check the sources
```

Environment: `PORT` (default `8791`), `HOST` (default `127.0.0.1`), `ORION_API_BASE` (default `https://orionlabsone.cc`), `CELENIUM_BASE` (default `https://api-mainnet.celenium.io/v1`, used by the drill-down tools).

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
   │  MCP — read-only analysis tools, resources & prompts
   ▼
orion-agent-kit  ──►  Orion daily analysis (orionlabsone.cc/api)
        │                 │  every figure linked to its source
        │                 ▼
        │             Celestia LCD · market data
        └──────────►  Celenium API   (live namespace & validator drill-down)
```

## License

[Apache-2.0](./LICENSE), Copyright 2026 Orion Labs. Questions, ideas, or a tool you wish existed: open an issue.
