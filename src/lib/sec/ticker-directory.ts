import {
  fetchCompanyTickersExchange,
  type SecTickerExchangeRow,
} from "@/lib/sec/client";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const VALID_TICKER_RE = /^[A-Z0-9.-]{1,10}$/;

interface DirectoryCache {
  rows: SecTickerExchangeRow[];
  byTicker: Map<string, SecTickerExchangeRow>;
  fetchedAt: number;
  inFlight: Promise<DirectoryCache | null> | null;
}

const globalForDir = globalThis as typeof globalThis & {
  __kkvalTickerDirectory?: DirectoryCache;
};

async function loadDirectory(): Promise<DirectoryCache | null> {
  const existing = globalForDir.__kkvalTickerDirectory;
  if (existing && existing.rows.length > 0 && Date.now() - existing.fetchedAt < CACHE_TTL_MS) {
    return existing;
  }

  if (existing?.inFlight) {
    return existing.inFlight;
  }

  const state: DirectoryCache = existing ?? {
    rows: [],
    byTicker: new Map(),
    fetchedAt: 0,
    inFlight: null,
  };
  globalForDir.__kkvalTickerDirectory = state;

  state.inFlight = (async () => {
    try {
      const rows = await fetchCompanyTickersExchange();
      if (rows.length > 0) {
        const byTicker = new Map<string, SecTickerExchangeRow>();
        for (const r of rows) {
          if (!byTicker.has(r.ticker)) {
            byTicker.set(r.ticker, r);
          }
        }
        state.rows = rows;
        state.byTicker = byTicker;
        state.fetchedAt = Date.now();
      }
      return state;
    } catch {
      return state.rows.length > 0 ? state : null;
    } finally {
      state.inFlight = null;
    }
  })();

  return state.inFlight;
}

export function isValidTickerShape(rawTicker: string): boolean {
  return VALID_TICKER_RE.test(rawTicker.trim().toUpperCase());
}

export async function lookupSecTicker(
  rawTicker: string,
): Promise<SecTickerExchangeRow | null> {
  const upper = rawTicker.trim().toUpperCase();
  if (!isValidTickerShape(upper)) return null;

  const dir = await loadDirectory();
  if (!dir) return null;
  return dir.byTicker.get(upper) ?? null;
}

export function rankTickerMatches<
  T extends { ticker: string; name: string; exchange: string | null },
>(rows: readonly T[], query: string, limit = 10): T[] {
  const q = query.trim();
  if (!q) return [];
  const upper = q.toUpperCase();
  const lower = q.toLowerCase();

  const exact: T[] = [];
  const prefix: T[] = [];
  const nameMatch: T[] = [];
  const seen = new Set<string>();

  for (const r of rows) {
    const tUpper = r.ticker.toUpperCase();
    if (seen.has(tUpper)) continue;
    if (tUpper === upper) {
      seen.add(tUpper);
      exact.push(r);
    } else if (tUpper.startsWith(upper)) {
      seen.add(tUpper);
      prefix.push(r);
    } else if (r.name.toLowerCase().includes(lower)) {
      seen.add(tUpper);
      nameMatch.push(r);
    }
  }

  prefix.sort((a, b) => a.ticker.length - b.ticker.length || a.ticker.localeCompare(b.ticker));
  return [...exact, ...prefix, ...nameMatch].slice(0, limit);
}

export async function searchSecTickerDirectory(
  query: string,
  limit = 10,
): Promise<SecTickerExchangeRow[]> {
  if (!query.trim()) return [];
  const dir = await loadDirectory();
  if (!dir) return [];
  return rankTickerMatches(dir.rows, query, limit);
}
