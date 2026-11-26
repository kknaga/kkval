import {
  fetchCompanyFacts,
  fetchSubmissions,
} from "@/lib/sec/client";
import {
  backfillCompanyForm4sAndRefreshHealth,
  upsertCompanyAndHealth,
} from "@/lib/sec/company-upsert";
import { loadFxRatesMap } from "@/lib/sec/fx";
import { lookupSecTicker } from "@/lib/sec/ticker-directory";

const FAILURE_COOLDOWN_MS = 5 * 60 * 1000;

interface OnDemandState {
  inFlightByCik: Map<string, Promise<boolean>>;
  recentFailureByCik: Map<string, number>;
  form4BackfillInFlight: Set<string>;
}

const globalForOnDemand = globalThis as typeof globalThis & {
  __kkvalOnDemand?: OnDemandState;
};

function getState(): OnDemandState {
  if (!globalForOnDemand.__kkvalOnDemand) {
    globalForOnDemand.__kkvalOnDemand = {
      inFlightByCik: new Map(),
      recentFailureByCik: new Map(),
      form4BackfillInFlight: new Set(),
    };
  }
  return globalForOnDemand.__kkvalOnDemand;
}

export async function ensureCompanyIngested(rawTicker: string): Promise<boolean> {
  const row = await lookupSecTicker(rawTicker);
  if (!row) return false;

  const state = getState();
  const failedAt = state.recentFailureByCik.get(row.cik);
  if (failedAt && Date.now() - failedAt < FAILURE_COOLDOWN_MS) {
    return false;
  }

  const existingPromise = state.inFlightByCik.get(row.cik);
  if (existingPromise) {
    return existingPromise;
  }

  const job = (async () => {
    try {
      const [submissions, facts, fxRates] = await Promise.all([
        fetchSubmissions(row.cik),
        fetchCompanyFacts(row.cik),
        loadFxRatesMap(),
      ]);

      if (!submissions) {
        state.recentFailureByCik.set(row.cik, Date.now());
        return false;
      }

      const { form4Entries } = await upsertCompanyAndHealth({
        tickerRow: row,
        submissions,
        facts,
        fxRates,
        fetchForm4s: false,
      });

      state.recentFailureByCik.delete(row.cik);

      // Fire-and-forget Form 4 XML backfill so initial page load stays ~1s
      if (form4Entries.length > 0 && !state.form4BackfillInFlight.has(row.cik)) {
        state.form4BackfillInFlight.add(row.cik);
        void backfillCompanyForm4sAndRefreshHealth({
          tickerRow: row,
          submissions,
          facts,
          fxRates,
          form4Entries,
        })
          .catch(() => {
            // Best-effort background Form 4 backfill
          })
          .finally(() => {
            state.form4BackfillInFlight.delete(row.cik);
          });
      }

      return true;
    } catch {
      state.recentFailureByCik.set(row.cik, Date.now());
      return false;
    } finally {
      state.inFlightByCik.delete(row.cik);
    }
  })();

  state.inFlightByCik.set(row.cik, job);
  return job;
}
