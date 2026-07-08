/**
 * Orion Celestia Intel — MCP tools.
 * Analysis layer over live Celestia data: Orion's daily verdicts and anomaly signals.
 * Strictly read-only: no wallets, no keys, no transactions.
 */
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  isValidDate,
  orionApi,
  celeniumApi,
  CELENIUM_BASE_URL,
  OrionApiError,
  Report,
  Signal,
} from "./orion-api.js";

const SEVERITY_RANK: Record<string, number> = { info: 0, notable: 1, critical: 2 };

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function fail(message: string) {
  return { content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }], isError: true };
}

function briefOf(report: Report) {
  const s = report.snapshot;
  const headline =
    report.signals.length === 0
      ? "No signals today — network within baseline."
      : report.signals.map((x) => `[${x.severity}] ${x.title}`).join(" · ");
  return {
    date: report.date,
    generated_at: report.generated_at,
    network: report.network,
    headline,
    signals: report.signals.map((x) => ({
      severity: x.severity,
      title: x.title,
      detail: x.detail,
      metric: x.metric,
      value: x.value,
      baseline: x.baseline,
      source: x.source,
    })),
    key_metrics: {
      height: s.height,
      total_blobs_tb: s.total_blobs_tb,
      active_validators: s.active_validators,
      total_validators_registered: s.total_validators,
      bonded_ratio_of_total_supply_pct: s.bonded_ratio_supply,
      nakamoto_coefficient_halting: s.nakamoto_halting,
      tia_price_usd: s.tia_price,
    },
    provenance: report.provenance,
    note: "Every figure traces to the on-chain or indexer source listed in provenance.",
  };
}

function reportNotFound(date: string, index: { date: string }[]) {
  if (!index.length) return fail(`No report for ${date}, and the archive index is currently empty or unavailable.`);
  const first = index[index.length - 1]?.date;
  const last = index[0]?.date;
  return fail(`No report for ${date}. Archive covers ${first} to ${last} (daily). Use list_reports to see available dates.`);
}

export function registerTools(server: McpServer): void {
  server.registerTool(
    "get_daily_brief",
    {
      title: "Today's Celestia network brief",
      description:
        "Orion's latest daily analysis of the Celestia mainnet: headline, anomaly signals with severity, key network metrics, and provenance links for every figure. Start here for 'what is happening on Celestia today?'. Set include_narrative for Orion's written prose summary.",
      inputSchema: {
        include_narrative: z
          .boolean()
          .optional()
          .describe("Also return Orion's written prose narrative (markdown, with a citation check)"),
      },
    },
    async ({ include_narrative }) => {
      try {
        const r = await orionApi.latest();
        const out: Record<string, unknown> = briefOf(r);
        if (include_narrative && r.narrative) out.narrative = r.narrative;
        return ok(out);
      } catch (e) {
        return fail(String(e));
      }
    }
  );

  server.registerTool(
    "get_signals",
    {
      title: "Anomaly signals",
      description:
        "Anomaly/health signals detected by Orion for a given day (default: latest). Each signal has type, severity (info|notable|critical), observed value vs rolling baseline, and its data source. Filter with min_severity.",
      inputSchema: {
        date: z.string().optional().describe("Report date YYYY-MM-DD; omit for the latest report"),
        min_severity: z.enum(["info", "notable", "critical"]).optional().describe("Only signals at or above this severity"),
      },
    },
    async ({ date, min_severity }) => {
      try {
        if (date && !isValidDate(date)) return fail(`Invalid date "${date}" — expected YYYY-MM-DD.`);
        let report: Report;
        if (date) {
          try {
            report = await orionApi.report(date);
          } catch (e) {
            if (e instanceof OrionApiError && e.status === 404) return reportNotFound(date, await orionApi.reportIndex());
            throw e;
          }
        } else {
          report = await orionApi.latest();
        }
        const min = SEVERITY_RANK[min_severity ?? "info"];
        const signals = report.signals.filter((s: Signal) => (SEVERITY_RANK[s.severity] ?? 0) >= min);
        return ok({ date: report.date, count: signals.length, signals, summary: report.summary });
      } catch (e) {
        return fail(String(e));
      }
    }
  );

  server.registerTool(
    "get_network_state",
    {
      title: "Celestia network state",
      description:
        "Current Celestia mainnet metrics from Orion's latest snapshot: height, DA volume (TB), fees, validators (active vs registered), staking ratios, Nakamoto coefficient, jail count, TIA price — with provenance links.",
      inputSchema: {},
    },
    async () => {
      try {
        const r = await orionApi.latest();
        const s = r.snapshot;
        return ok({
          as_of: r.generated_at,
          network: r.network,
          height: s.height,
          data_availability: { total_blobs_tb: s.total_blobs_tb, total_tx: s.total_tx, total_fee_tia: s.total_fee_tia },
          validators: {
            active: s.active_validators,
            registered_total: s.total_validators,
            jailed_or_inactive_note: `${s.jail_count} registered validators are jailed; active set is ${s.active_validators}.`,
            nakamoto_coefficient_halting: s.nakamoto_halting,
          },
          staking: {
            bonded_ratio_pct: s.bonded_ratio,
            bonded_ratio_of_total_supply_pct: s.bonded_ratio_supply,
            note: "bonded_ratio_pct is bonded vs stakeable tokens; bonded_ratio_of_total_supply_pct is bonded vs TOTAL supply — cite the supply-based figure when talking about 'X% of supply is staked'.",
          },
          tia_price_usd: s.tia_price,
          provenance: r.provenance,
        });
      } catch (e) {
        return fail(String(e));
      }
    }
  );

  server.registerTool(
    "list_reports",
    {
      title: "Report archive index",
      description: "Index of Orion's daily Celestia reports (date + signal counts), newest first.",
      inputSchema: {
        limit: z.number().int().min(1).max(365).optional().describe("Max entries to return (default 30)"),
      },
    },
    async ({ limit }) => {
      try {
        const index = await orionApi.reportIndex();
        return ok({ total_available: index.length, reports: index.slice(0, limit ?? 30) });
      } catch (e) {
        return fail(String(e));
      }
    }
  );

  server.registerTool(
    "get_report",
    {
      title: "Full daily report",
      description: "Full Orion report for a specific date (YYYY-MM-DD): snapshot metrics, all signals, summary, provenance.",
      inputSchema: {
        date: z.string().describe("Report date YYYY-MM-DD (see list_reports for available dates)"),
      },
    },
    async ({ date }) => {
      try {
        if (!isValidDate(date)) return fail(`Invalid date "${date}" — expected YYYY-MM-DD.`);
        try {
          return ok(await orionApi.report(date));
        } catch (e) {
          if (e instanceof OrionApiError && e.status === 404) return reportNotFound(date, await orionApi.reportIndex());
          throw e;
        }
      } catch (e) {
        return fail(String(e));
      }
    }
  );

  server.registerTool(
    "search_reports",
    {
      title: "Search the report archive",
      description:
        "Keyword search across recent daily reports (signal titles, details, types, metrics). Returns matching signals grouped by date. Plain keyword scan — no LLM in the loop, results are verbatim from the archive.",
      inputSchema: {
        query: z.string().min(2).describe("Keyword or phrase, e.g. 'eclipse', 'block time', 'namespace'"),
        limit: z.number().int().min(1).max(60).optional().describe("How many recent reports to scan (default 14)"),
      },
    },
    async ({ query, limit }) => {
      try {
        const index = await orionApi.reportIndex();
        const dates = index.slice(0, limit ?? 14).map((e) => e.date);
        const q = query.toLowerCase();
        const results: { date: string; matches: Signal[] }[] = [];
        // Fetch in bounded-concurrency batches so one slow day can't serialize the
        // whole scan into (days x timeout) seconds; unreadable days are skipped.
        const BATCH = 8;
        for (let i = 0; i < dates.length; i += BATCH) {
          const batch = dates.slice(i, i + BATCH);
          const settled = await Promise.allSettled(batch.map((d) => orionApi.report(d)));
          settled.forEach((outcome, j) => {
            if (outcome.status !== "fulfilled") return;
            const r = outcome.value;
            const matches = r.signals.filter((s) =>
              [s.title, s.detail, s.type, s.metric].some((f) => f?.toLowerCase().includes(q))
            );
            if (matches.length) results.push({ date: batch[j], matches });
          });
        }
        results.sort((a, b) => (a.date < b.date ? 1 : -1));
        return ok({
          query,
          scanned_reports: dates.length,
          scanned_range: dates.length ? `${dates[dates.length - 1]} → ${dates[0]}` : "none",
          matching_days: results.length,
          results,
        });
      } catch (e) {
        return fail(String(e));
      }
    }
  );

  server.registerTool(
    "get_trends",
    {
      title: "Network trends (day-over-day)",
      description:
        "Day-over-day and week-over-week change for key Celestia metrics, computed from Orion's daily snapshots. Answers 'what changed since yesterday / last week?'.",
      inputSchema: {},
    },
    async () => {
      try {
        const index = await orionApi.reportIndex(); // newest first
        const dates = index.slice(0, 8).map((e) => e.date);
        const settled = await Promise.all(dates.map((d) => orionApi.report(d).catch(() => null)));
        const snaps = settled.filter((r): r is Report => !!r).map((r) => ({ date: r.date, s: r.snapshot }));
        if (snaps.length < 2) return ok({ note: "Not enough history yet — need at least 2 daily reports.", days_available: snaps.length });
        const cur = snaps[0], prev = snaps[1], weekAgo = snaps[snaps.length - 1];
        const pct = (a: number, b: number) => (b ? +(((a - b) / Math.abs(b)) * 100).toFixed(2) : null);
        const trend = (m: string) => {
          const c = Number(cur.s[m]), p = Number(prev.s[m]), w = Number(weekAgo.s[m]);
          const d1 = c - p;
          return {
            current: c, day_ago: p, week_ago: w,
            delta_1d: +d1.toFixed(6), pct_1d: pct(c, p),
            delta_7d: +(c - w).toFixed(6), pct_7d: pct(c, w),
            direction: d1 > 0 ? "up" : d1 < 0 ? "down" : "flat",
          };
        };
        const METRICS = ["total_blobs_tb", "total_fee_tia", "tia_price", "bonded_ratio_supply", "active_validators", "jail_count", "nakamoto_halting", "total_tx"];
        const metrics: Record<string, unknown> = {};
        for (const m of METRICS) metrics[m] = trend(m);
        return ok({ latest: cur.date, previous: prev.date, week_ago: weekAgo.date, window_days: snaps.length, metrics, note: "Deltas from Orion daily snapshots; each underlying figure is provenance-linked in get_report." });
      } catch (e) {
        return fail(String(e));
      }
    }
  );

  const HISTORY_METRICS = ["height", "total_fee_tia", "total_blobs_tb", "total_tx", "total_validators", "active_validators", "tia_price", "bonded_ratio", "bonded_ratio_supply", "nakamoto_halting", "jail_count"] as const;

  server.registerTool(
    "get_metric_history",
    {
      title: "Metric history series",
      description: `Time series of one snapshot metric across Orion's daily reports, oldest to newest. Metrics: ${HISTORY_METRICS.join(", ")}.`,
      inputSchema: {
        metric: z.enum(HISTORY_METRICS).describe("Which snapshot metric to chart"),
        days: z.number().int().min(2).max(365).optional().describe("How many recent days (default 30)"),
      },
    },
    async ({ metric, days }) => {
      try {
        const index = await orionApi.reportIndex();
        const dates = index.slice(0, days ?? 30).map((e) => e.date);
        const settled = await Promise.all(dates.map((d) => orionApi.report(d).catch(() => null)));
        const series = settled
          .filter((r): r is Report => !!r)
          .map((r) => ({ date: r.date, value: Number(r.snapshot[metric]) }))
          .filter((p) => Number.isFinite(p.value))
          .reverse();
        return ok({ metric, points: series.length, series });
      } catch (e) {
        return fail(String(e));
      }
    }
  );

  server.registerTool(
    "get_top_namespaces",
    {
      title: "Top Celestia namespaces by DA volume",
      description: "Largest namespaces (rollups) on Celestia by total blob size, live from Celenium. Shows who is posting the most data to the DA layer.",
      inputSchema: { limit: z.number().int().min(1).max(50).optional().describe("How many namespaces (default 10)") },
    },
    async ({ limit }) => {
      try {
        const rows = await celeniumApi.topNamespaces(limit ?? 10);
        const total = rows.reduce((s, n) => s + (Number(n.size) || 0), 0);
        const namespaces = rows.map((n) => {
          const size = Number(n.size) || 0;
          return {
            name: n.name || null,
            namespace_id: n.namespace_id || null,
            size_bytes: size,
            size_tb: +(size / 1e12).toFixed(4),
            blobs: n.blobs_count ?? null,
            share_of_shown_pct: total ? +((size / total) * 100).toFixed(2) : null,
            last_activity: n.last_message_time || null,
          };
        });
        return ok({ count: namespaces.length, namespaces, source: `${CELENIUM_BASE_URL}/namespace`, note: "share_of_shown_pct is relative to the namespaces returned here, not all of Celestia." });
      } catch (e) {
        return fail(String(e));
      }
    }
  );

  server.registerTool(
    "get_namespace",
    {
      title: "Namespace detail",
      description: "Detail for a single Celestia namespace by its namespace_id (hex — get one from get_top_namespaces): size, blob count, last activity.",
      inputSchema: { namespace_id: z.string().min(2).describe("Namespace id (hex), e.g. from get_top_namespaces") },
    },
    async ({ namespace_id }) => {
      try {
        const arr = await celeniumApi.namespace(namespace_id);
        const n = Array.isArray(arr) ? arr[0] : arr;
        if (!n) return fail(`No namespace "${namespace_id}". Use get_top_namespaces for valid ids.`);
        const size = Number(n.size) || 0;
        return ok({
          name: n.name || null,
          namespace_id: n.namespace_id || namespace_id,
          version: n.version ?? null,
          size_bytes: size,
          size_tb: +(size / 1e12).toFixed(4),
          blobs: n.blobs_count ?? null,
          pfb_count: n.pfb_count ?? null,
          last_height: n.last_height ?? null,
          last_activity: n.last_message_time || null,
          source: `${CELENIUM_BASE_URL}/namespace/${namespace_id}`,
        });
      } catch (e) {
        if (e instanceof OrionApiError && e.status === 404) return fail(`No namespace "${namespace_id}". Use get_top_namespaces for valid ids.`);
        return fail(String(e));
      }
    }
  );

  server.registerTool(
    "get_top_validators",
    {
      title: "Top Celestia validators by stake",
      description: "Largest Celestia validators by stake, live from Celenium: moniker, stake (TIA), commission, jailed status.",
      inputSchema: { limit: z.number().int().min(1).max(100).optional().describe("How many validators (default 20)") },
    },
    async ({ limit }) => {
      try {
        const rows = await celeniumApi.topValidators(limit ?? 20);
        const validators = rows
          .map((v) => {
            let rate = Number(v.rate) || 0;
            if (rate > 1) rate = rate / 100;
            const stakeUtia = Number(v.stake) || 0;
            return { moniker: v.moniker || null, stake_tia: +(stakeUtia / 1e6).toFixed(0), commission_pct: +(rate * 100).toFixed(1), jailed: !!v.jailed };
          })
          .sort((a, b) => b.stake_tia - a.stake_tia);
        return ok({ count: validators.length, validators, source: `${CELENIUM_BASE_URL}/validators` });
      } catch (e) {
        return fail(String(e));
      }
    }
  );
}

export function registerResources(server: McpServer): void {
  server.registerResource(
    "latest-brief",
    "orion://latest",
    { title: "Latest Celestia daily brief", description: "Orion's most recent daily Celestia report (JSON).", mimeType: "application/json" },
    async (uri) => {
      const r = await orionApi.latest();
      return { contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(r, null, 2) }] };
    }
  );

  server.registerResource(
    "report-index",
    "orion://reports",
    { title: "Report archive index", description: "Index of Orion's daily Celestia reports (date + signal counts).", mimeType: "application/json" },
    async (uri) => {
      const idx = await orionApi.reportIndex();
      return { contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(idx, null, 2) }] };
    }
  );

  server.registerResource(
    "daily-report",
    new ResourceTemplate("orion://report/{date}", { list: undefined }),
    { title: "Daily Celestia report by date", description: "Full Orion report for a date: orion://report/YYYY-MM-DD.", mimeType: "application/json" },
    async (uri, { date }) => {
      const d = String(Array.isArray(date) ? date[0] : date);
      if (!isValidDate(d)) throw new Error(`Invalid date "${d}" — expected YYYY-MM-DD.`);
      const r = await orionApi.report(d);
      return { contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(r, null, 2) }] };
    }
  );
}

export function registerPrompts(server: McpServer): void {
  server.registerPrompt(
    "daily_celestia_briefing",
    { title: "Daily Celestia briefing", description: "Produce a grounded daily briefing on Celestia using Orion's tools." },
    () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              "Use get_daily_brief and get_signals to summarise the current state of the Celestia network. Lead with anything at notable or critical severity. Include the key metrics (DA volume in TB, active validators, staking ratio of TOTAL supply, TIA price) and cite the provenance link for each figure. If nothing is notable, say so plainly. Then call get_trends and note what changed versus yesterday.",
          },
        },
      ],
    })
  );

  server.registerPrompt(
    "rollup_da_check",
    { title: "Rollup DA landscape check", description: "Survey who posts the most data to Celestia and the current DA cost context." },
    () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              "Use get_top_namespaces to list the rollups posting the most data to Celestia right now, and get_network_state for current DA volume, fees and TIA price. Summarise the DA landscape: who dominates blobspace, how concentrated it is, and the current cost context. Cite the Celenium sources returned by the tools.",
          },
        },
      ],
    })
  );
}

export const SERVER_INFO = { name: "orion-celestia-intel", version: "1.0.0" };
