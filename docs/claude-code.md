# Claude Code

## Hosted endpoint (recommended)

```bash
claude mcp add --transport http orion https://orionlabsone.cc/mcp
```

Or clone this repo and run `claude` inside it — the bundled `.mcp.json` connects automatically, and you get the `/brief` and `/signals` commands.

## Local stdio (self-hosted)

```bash
claude mcp add orion -- npx tsx /path/to/orion-agent-kit/src/index.ts
```

## Try it

> Any anomalies on Celestia today? Cite sources.
