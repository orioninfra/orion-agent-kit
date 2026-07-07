/**
 * Orion Celestia Intel — MCP tools.
 * Analysis layer over live Celestia data: Orion's daily verdicts and anomaly signals.
 * Strictly read-only: no wallets, no keys, no transactions.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { isValidDate, orionApi, OrionApiError, Report, Signal } from "./orion-api.js";

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
        "Orion's latest daily analysis of the Celestia mainnet: headline, anomaly signals with severity, key network metrics, and provenance links for every figure. Start here for 'what is happening on Celestia today?'.",
      inputSchema: {},
    },
    async () => {
      try {
        return ok(briefOf(await orionApi.latest()));
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
}

export const SERVER_INFO = { name: "orion-celestia-intel", version: "1.0.0" };
