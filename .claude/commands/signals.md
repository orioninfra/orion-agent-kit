---
description: Search or filter Orion's Celestia anomaly signals
argument-hint: [keyword or severity]
---
The user wants signals: $ARGUMENTS

- If the argument looks like a severity (info / notable / critical), call `get_signals` with that `min_severity`.
- If it looks like a keyword or topic (e.g. "eclipse", "block time"), call `search_reports` with it as `query`.
- If empty, call `get_signals` for the latest report.

Report each match with date, severity, observed value vs baseline, and source. If nothing matches, say so plainly — do not speculate.
