import { db } from "@/db";
import { fxRates } from "@/db/schema";

const FALLBACK_RATES: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  DKK: 6.85,
  CNY: 7.1,
  RMB: 7.1,
  GBP: 0.78,
  CAD: 1.4,
  JPY: 155,
  CHF: 0.88,
  AUD: 1.54,
  HKD: 7.78,
  ILS: 3.7,
  KRW: 1390,
  TWD: 32.3,
  SEK: 10.7,
  NOK: 11.0,
  BRL: 5.8,
  MXN: 20.3,
};

export async function refreshFxRates(): Promise<Map<string, number>> {
  const rates = new Map<string, number>(Object.entries(FALLBACK_RATES));
  let asOfDate = new Date().toISOString().slice(0, 10);

  try {
    const res = await fetch("https://api.frankfurter.dev/v1/latest?base=USD", {
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) {
      const json = (await res.json()) as {
        date?: string;
        rates?: Record<string, number>;
      };
      if (json.date) asOfDate = json.date;
      if (json.rates) {
        for (const [curr, val] of Object.entries(json.rates)) {
          if (typeof val === "number" && Number.isFinite(val) && val > 0) {
            rates.set(curr.toUpperCase(), val);
          }
        }
      }
    }
  } catch {
    // Use fallback rates if offline
  }

  for (const [currency, ratePerUsd] of rates.entries()) {
    await db
      .insert(fxRates)
      .values({ currency, ratePerUsd, asOfDate, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: fxRates.currency,
        set: { ratePerUsd, asOfDate, updatedAt: new Date() },
      });
  }

  return rates;
}

export async function loadFxRatesMap(): Promise<Map<string, number>> {
  const map = new Map<string, number>(Object.entries(FALLBACK_RATES));
  try {
    const rows = await db.select().from(fxRates);
    for (const r of rows) {
      map.set(r.currency.toUpperCase(), r.ratePerUsd);
    }
  } catch {
    // DB unavailable fallback
  }
  return map;
}
