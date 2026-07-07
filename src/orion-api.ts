/**
 * Thin client for Orion's public Celestia intelligence API.
 * Read-only. In-memory cache keeps us gentle on the origin.
 */

const BASE = process.env.ORION_API_BASE ?? "https://orionlabsone.cc";
const CACHE_TTL_MS = 5 * 60 * 1000;
const FETCH_TIMEOUT_MS = 10_000;

export interface Signal {
  type: string;
  severity: "info" | "notable" | "critical" | string;
  title: string;
  detail: string;
  metric: string;
  value: number;
  baseline: number;
  source: string;
}

export interface Snapshot {
  height: number;
  total_fee_tia: number;
  total_blobs_tb: number;
  total_tx: number;
  total_validators: number;
  active_validators: number;
  tia_price: number;
  bonded_ratio: number;
  bonded_ratio_supply: number;
  nakamoto_halting: number;
  jail_count: number;
  [k: string]: number;
}

export interface Report {
  date: string;
  generated_at: string;
  height: number;
  network: string;
  snapshot: Snapshot;
  signals: Signal[];
  summary: { total_signals: number; critical: number; notable: number; info: number };
  provenance: Record<string, string>;
}

export interface ReportIndexEntry {
  date: string;
  total_signals: number;
  critical: number;
  notable: number;
  info: number;
}

const cache = new Map<string, { at: number; data: unknown }>();

async function getJson<T>(path: string): Promise<T> {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data as T;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}${path}`, {
      signal: ctrl.signal,
      headers: { "User-Agent": "orion-agent-kit/1.0", Accept: "application/json" },
    });
    if (!res.ok) throw new OrionApiError(res.status, path);
    const data = (await res.json()) as T;
    cache.set(path, { at: Date.now(), data });
    return data;
  } finally {
    clearTimeout(timer);
  }
}

export class OrionApiError extends Error {
  constructor(public status: number, public path: string) {
    super(`Orion API responded ${status} for ${path}`);
  }
}

export const orionApi = {
  latest: () => getJson<Report>("/api/latest"),
  reportIndex: () => getJson<ReportIndexEntry[]>("/api/reports"),
  report: (date: string) => getJson<Report>(`/api/reports/${date}`),
};

export function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}
