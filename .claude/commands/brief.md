---
description: Orion's daily Celestia network brief
---
Call the `get_daily_brief` tool from the orion MCP server. Present the result as a short briefing:
1. One-line verdict (is the network within baseline or not).
2. Each signal with its severity, observed value vs baseline, and its data source (the `source` field is a source name; match it to the `provenance` map for a checkable URL).
3. Key metrics worth noting today.
Always cite the provenance links so every figure can be checked. Do not add numbers that are not in the tool output.
