import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { companies, cusipMap } from "@/db/schema";

export interface ResolvedCusip {
  cusip: string;
  cik: string | null;
  ticker: string | null;
  issuerName: string | null;
}

export async function resolveCusipsViaOpenFigi(
  cusips: string[],
): Promise<Map<string, ResolvedCusip>> {
  const cleanCusips = Array.from(
    new Set(cusips.map((c) => c.trim().toUpperCase()).filter((c) => c.length >= 8)),
  );
  const out = new Map<string, ResolvedCusip>();
  if (cleanCusips.length === 0) return out;

  // Load company ticker -> cik lookup
  const allCompanies = await db
    .select({ cik: companies.cik, ticker: companies.ticker })
    .from(companies);
  const tickerToCik = new Map<string, string>(
    allCompanies.map((c) => [c.ticker.toUpperCase(), c.cik]),
  );

  // Check cached cusip_map first
  const cached = await db
    .select()
    .from(cusipMap)
    .where(inArray(cusipMap.cusip, cleanCusips));

  const missing: string[] = [];
  const cachedSet = new Set<string>();
  for (const row of cached) {
    cachedSet.add(row.cusip);
    const resolvedCik =
      row.cik ?? (row.ticker ? tickerToCik.get(row.ticker.toUpperCase()) ?? null : null);
    out.set(row.cusip, {
      cusip: row.cusip,
      cik: resolvedCik,
      ticker: row.ticker,
      issuerName: row.issuerName,
    });
  }
  for (const c of cleanCusips) {
    if (!cachedSet.has(c)) missing.push(c);
  }

  // Batch query OpenFIGI (max 10 per unauthenticated call, 100 with API key)
  const apiKey = process.env.OPENFIGI_API_KEY?.trim();
  const batchSize = apiKey ? 100 : 10;
  const delayMs = apiKey ? 250 : 2500;

  for (let i = 0; i < missing.length; i += batchSize) {
    const batch = missing.slice(i, i + batchSize);
    const body = batch.map((c) => ({
      idType: "ID_CUSIP",
      idValue: c,
      exchCode: "US",
    }));

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (apiKey) headers["X-OPENFIGI-APIKEY"] = apiKey;

      const res = await fetch("https://api.openfigi.com/v3/mapping", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) {
        if (res.status === 429) {
          await new Promise((r) => setTimeout(r, 10_000));
        }
        continue;
      }

      const json = (await res.json()) as Array<{
        data?: Array<{
          ticker?: string;
          name?: string;
          securityType?: string;
        }>;
      }>;

      for (let idx = 0; idx < batch.length; idx++) {
        const cusip = batch[idx];
        const first = json[idx]?.data?.[0];
        const ticker = first?.ticker?.trim().toUpperCase() || null;
        const cik = ticker ? tickerToCik.get(ticker) ?? null : null;
        const issuerName = first?.name?.trim() || null;

        await db
          .insert(cusipMap)
          .values({
            cusip,
            cik,
            ticker,
            issuerName,
            securityType: first?.securityType || null,
            source: "openfigi",
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: cusipMap.cusip,
            set: {
              cik,
              ticker,
              issuerName,
              securityType: first?.securityType || null,
              updatedAt: new Date(),
            },
          });

        out.set(cusip, { cusip, cik, ticker, issuerName });
      }
    } catch {
      // Ignore single OpenFIGI batch failure
    }

    if (i + batchSize < missing.length) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  return out;
}
