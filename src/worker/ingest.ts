import fs from "node:fs";
import path from "node:path";
import yauzl from "yauzl";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  companies,
  companyHealthSnapshots,
  financialPeriods,
  ingestionRuns,
  insiderTransactions,
  institutionalHoldings,
  recentFilings,
  type NewRecentFilingRow,
} from "@/db/schema";
import {
  discoverLatestDera13fZipUrl,
  downloadFileIfStale,
  fetchCompanyFacts,
  fetchCompanyTickersExchange,
  fetchDailyFormIndex,
  fetchForm4Xml,
  fetchSubmissions,
  padCik,
  type SecCompanyFactsJson,
  type SecSubmissionsJson,
  type SecTickerExchangeRow,
} from "@/lib/sec/client";
import { normalizeCompanyFacts } from "@/lib/sec/xbrl-normalizer";
import { computeHealthSnapshot } from "@/lib/health/compute";
import {
  parseDailyFormIndexForForm4,
  parseForm4Xml,
  type ParsedForm4Transaction,
} from "@/lib/sec/form4";
import { parseDera13fZip } from "@/lib/sec/form13f";
import { resolveCusipsViaOpenFigi } from "@/lib/sec/cusip";
import { refreshFxRates } from "@/lib/sec/fx";

export const SAMPLE_TICKERS = [
  // Large-cap benchmarks (including 2-letter tickers that share codes with locales)
  "AAPL",
  "MSFT",
  "NVDA",
  "AMZN",
  "META",
  "TSLA",
  "GOOGL",
  "KO",
  "DE",
  "ES",
  // Popular small/mid-cap retail & cash-burn names
  "RGTI",
  "PLUG",
  "SOUN",
  "BBAI",
  "IONQ",
  "QBTS",
  "DNA",
  "CLOV",
  "OPEN",
  "LCID",
  "RIVN",
  "MARA",
  "RIOT",
  "PLTR",
  "HIMS",
  "CVEO",
  "ERII",
  "TWFG",
  // Foreign ADRs (IFRS & non-USD)
  "NVO",
  "BABA",
  "ASML",
  "TSM",
  "NIO",
  // Bank & SPAC edge cases
  "JPM",
  "CBNA",
  "WLCO",
];

const DILUTION_FORMS = new Set([
  "S-3",
  "S-3ASR",
  "424B5",
  "424B3",
  "S-1",
  "F-3",
  "F-1",
]);

function getCacheDir(): string {
  return process.env.SEC_CACHE_DIR?.trim() || path.join(process.cwd(), "data/sec-cache");
}

function chooseCanonicalTicker(
  tickers: string[],
  fallbackTicker: string,
): string {
  if (tickers.length === 0) return fallbackTicker.toUpperCase();
  const upper = tickers.map((t) => t.toUpperCase());
  // Prefer shortest ticker without warrant/unit suffixes (e.g., RGTI over RGTIW)
  const sorted = [...upper].sort((a, b) => {
    const aWarrant = a.length >= 5 && /[WRU]$/.test(a) ? 1 : 0;
    const bWarrant = b.length >= 5 && /[WRU]$/.test(b) ? 1 : 0;
    if (aWarrant !== bWarrant) return aWarrant - bWarrant;
    if (a.length !== b.length) return a.length - b.length;
    return a.localeCompare(b);
  });
  return sorted[0];
}

function extractRecentFilings(
  cik: string,
  sub: SecSubmissionsJson,
  limit = 60,
): {
  filings: NewRecentFilingRow[];
  forms: string[];
  offeringFilings12m: number;
  lastFilingDate: string | null;
  form4Entries: Array<{ accn: string; filingDate: string; primaryDocument: string }>;
} {
  const rec = sub.filings?.recent;
  if (!rec?.form) {
    return {
      filings: [],
      forms: [],
      offeringFilings12m: 0,
      lastFilingDate: null,
      form4Entries: [],
    };
  }

  const cutoff12m = new Date(Date.now() - 365 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const cutoff180d = new Date(Date.now() - 180 * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const filings: NewRecentFilingRow[] = [];
  const formSet = new Set<string>();
  const form4Entries: Array<{
    accn: string;
    filingDate: string;
    primaryDocument: string;
  }> = [];
  let offeringFilings12m = 0;
  let lastFilingDate: string | null = null;

  for (let i = 0; i < rec.form.length; i++) {
    const form = (rec.form[i] ?? "").trim();
    const filingDate = (rec.filingDate[i] ?? "").trim();
    const accn = (rec.accessionNumber[i] ?? "").trim();
    const primaryDocument = (rec.primaryDocument[i] ?? "").trim();
    if (!form || !filingDate || !accn) continue;

    formSet.add(form);
    if (!lastFilingDate || filingDate > lastFilingDate) {
      lastFilingDate = filingDate;
    }

    const isDilutionFiling = DILUTION_FORMS.has(form);
    if (isDilutionFiling && filingDate >= cutoff12m) {
      offeringFilings12m++;
    }

    if (form === "4" && filingDate >= cutoff180d && form4Entries.length < 15) {
      form4Entries.push({ accn, filingDate, primaryDocument });
    }

    if (
      filings.length < limit &&
      (isDilutionFiling ||
        form === "10-K" ||
        form === "10-K/A" ||
        form === "10-Q" ||
        form === "10-Q/A" ||
        form === "20-F" ||
        form === "40-F" ||
        form === "8-K" ||
        form === "4" ||
        form === "144")
    ) {
      filings.push({
        accn,
        cik,
        form,
        filingDate,
        reportDate: rec.reportDate?.[i] || null,
        primaryDocument: primaryDocument || null,
        description: rec.primaryDocDescription?.[i] || null,
        isDilutionFiling,
      });
    }
  }

  return {
    filings,
    forms: Array.from(formSet),
    offeringFilings12m,
    lastFilingDate,
    form4Entries,
  };
}

async function getInsiderStats90d(cik: string): Promise<{
  buyCount: number;
  sellCount: number;
  netBuyUsd: number | null;
}> {
  const cutoff = new Date(Date.now() - 90 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const rows = await db
    .select()
    .from(insiderTransactions)
    .where(
      and(
        eq(insiderTransactions.cik, cik),
        eq(insiderTransactions.isOpenMarket, true),
        gte(insiderTransactions.filingDate, cutoff),
      ),
    );

  let buyCount = 0;
  let sellCount = 0;
  let net = 0;
  let hasVal = false;
  for (const r of rows) {
    if (r.transactionCode === "P") {
      buyCount++;
      if (r.totalValueUsd) {
        net += r.totalValueUsd;
        hasVal = true;
      }
    } else if (r.transactionCode === "S") {
      sellCount++;
      if (r.totalValueUsd) {
        net -= r.totalValueUsd;
        hasVal = true;
      }
    }
  }
  return { buyCount, sellCount, netBuyUsd: hasVal ? net : null };
}

async function getTopInstitutionalCount(cik: string): Promise<number> {
  const latestQ = await db
    .select({ quarterEnd: institutionalHoldings.quarterEnd })
    .from(institutionalHoldings)
    .where(eq(institutionalHoldings.cik, cik))
    .orderBy(desc(institutionalHoldings.quarterEnd))
    .limit(1);
  if (!latestQ[0]) return 0;

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(institutionalHoldings)
    .where(
      and(
        eq(institutionalHoldings.cik, cik),
        eq(institutionalHoldings.quarterEnd, latestQ[0].quarterEnd),
      ),
    );
  return count ?? 0;
}

async function upsertCompanyAndHealth(params: {
  tickerRow: SecTickerExchangeRow;
  submissions: SecSubmissionsJson;
  facts: SecCompanyFactsJson | null;
  fxRates: Map<string, number>;
  fetchForm4s?: boolean;
}): Promise<boolean> {
  const cik = padCik(params.tickerRow.cik);
  const allTickers = Array.from(
    new Set(
      [
        params.tickerRow.ticker.toUpperCase(),
        ...(params.submissions.tickers ?? []).map((t) => t.toUpperCase()),
      ].filter(Boolean),
    ),
  );
  const canonicalTicker = chooseCanonicalTicker(
    allTickers,
    params.tickerRow.ticker,
  );
  const exchange =
    params.tickerRow.exchange ?? params.submissions.exchanges?.[0] ?? null;

  const {
    filings,
    forms,
    offeringFilings12m,
    lastFilingDate,
    form4Entries,
  } = extractRecentFilings(cik, params.submissions);

  const normalized = params.facts
    ? normalizeCompanyFacts(params.facts)
    : { currency: "USD", taxonomies: [], annual: [], quarterly: [] };

  const periodsCount = normalized.annual.length + normalized.quarterly.length;
  const ratePerUsd = params.fxRates.get(normalized.currency) ?? 1;

  // Ensure company row exists first (FK target)
  await db
    .insert(companies)
    .values({
      cik,
      ticker: canonicalTicker,
      allTickers,
      name: params.submissions.name || params.tickerRow.name,
      exchange,
      sic: params.submissions.sic || null,
      sicDescription: params.submissions.sicDescription || null,
      entityClass: "operating",
      filerCategory: params.submissions.category || null,
      fiscalYearEnd: params.submissions.fiscalYearEnd || null,
      stateOfIncorporation: params.submissions.stateOfIncorporation || null,
      reportingCurrency: normalized.currency,
      isIndexable: false,
      periodsCount,
      lastFilingDate,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: companies.cik,
      set: {
        ticker: canonicalTicker,
        allTickers,
        name: params.submissions.name || params.tickerRow.name,
        exchange,
        sic: params.submissions.sic || null,
        sicDescription: params.submissions.sicDescription || null,
        filerCategory: params.submissions.category || null,
        fiscalYearEnd: params.submissions.fiscalYearEnd || null,
        stateOfIncorporation: params.submissions.stateOfIncorporation || null,
        reportingCurrency: normalized.currency,
        periodsCount,
        lastFilingDate,
        updatedAt: new Date(),
      },
    });

  // Upsert recent filings
  if (filings.length > 0) {
    await db
      .insert(recentFilings)
      .values(filings)
      .onConflictDoNothing({ target: recentFilings.accn });
  }

  // Optional Form 4 fetch (used in sample mode; bulk uses daily index)
  if (params.fetchForm4s && form4Entries.length > 0) {
    const parsedTxs: ParsedForm4Transaction[] = [];
    for (const f4 of form4Entries.slice(0, 10)) {
      if (!f4.primaryDocument) continue;
      try {
        const xml = await fetchForm4Xml(cik, f4.accn, f4.primaryDocument);
        if (xml) {
          parsedTxs.push(
            ...parseForm4Xml(xml, {
              cik,
              accn: f4.accn,
              filingDate: f4.filingDate,
              primaryDocument: f4.primaryDocument,
            }),
          );
        }
      } catch {
        // Ignore single Form 4 XML fetch failure
      }
    }
    if (parsedTxs.length > 0) {
      await db
        .insert(insiderTransactions)
        .values(parsedTxs)
        .onConflictDoNothing();
    }
  }

  // Upsert normalized financial periods
  const allPeriods = [...normalized.annual, ...normalized.quarterly];
  if (allPeriods.length > 0) {
    for (const p of allPeriods) {
      await db
        .insert(financialPeriods)
        .values({
          cik,
          ...p,
        })
        .onConflictDoUpdate({
          target: [
            financialPeriods.cik,
            financialPeriods.periodType,
            financialPeriods.periodEnd,
          ],
          set: {
            fiscalYear: p.fiscalYear,
            fiscalPeriod: p.fiscalPeriod,
            currency: p.currency,
            revenue: p.revenue,
            grossProfit: p.grossProfit,
            operatingIncome: p.operatingIncome,
            netIncome: p.netIncome,
            cashAndEquivalents: p.cashAndEquivalents,
            shortTermInvestments: p.shortTermInvestments,
            totalLiquidity: p.totalLiquidity,
            operatingCashFlow: p.operatingCashFlow,
            capex: p.capex,
            freeCashFlow: p.freeCashFlow,
            totalDebt: p.totalDebt,
            sharesOutstanding: p.sharesOutstanding,
            isDecumulated: p.isDecumulated,
            provenanceJson: p.provenanceJson,
          },
        });
    }
  }

  const [insiderStats, instCount] = await Promise.all([
    getInsiderStats90d(cik),
    getTopInstitutionalCount(cik),
  ]);

  const health = computeHealthSnapshot({
    cik,
    ticker: canonicalTicker,
    name: params.submissions.name || params.tickerRow.name,
    sic: params.submissions.sic || null,
    taxonomies: normalized.taxonomies,
    forms,
    currency: normalized.currency,
    fxRatePerUsd: ratePerUsd,
    annual: normalized.annual,
    quarterly: normalized.quarterly,
    offeringFilings12m,
    insiderBuyCount90d: insiderStats.buyCount,
    insiderSellCount90d: insiderStats.sellCount,
    insiderNetBuy90dUsd: insiderStats.netBuyUsd,
    topInstitutionalCount: instCount,
  });

  await db
    .update(companies)
    .set({
      entityClass: health.entityClass,
      isIndexable: health.isIndexable,
    })
    .where(eq(companies.cik, cik));

  await db
    .insert(companyHealthSnapshots)
    .values({
      cik,
      verdict: health.verdict,
      cashRunwayMonths: health.cashRunwayMonths,
      isCashFlowPositive: health.isCashFlowPositive,
      quarterlyBurnNative: health.quarterlyBurnNative,
      quarterlyBurnUsd: health.quarterlyBurnUsd,
      totalLiquidityNative: health.totalLiquidityNative,
      totalLiquidityUsd: health.totalLiquidityUsd,
      shareDilution1yPct: health.shareDilution1yPct,
      shareDilution3yPct: health.shareDilution3yPct,
      possibleReverseSplit: health.possibleReverseSplit,
      debtToCashRatio: health.debtToCashRatio,
      netCashUsd: health.netCashUsd,
      fcfTtmNative: health.fcfTtmNative,
      fcfTtmUsd: health.fcfTtmUsd,
      revenueTtmNative: health.revenueTtmNative,
      revenueTtmUsd: health.revenueTtmUsd,
      revenueGrowthYoyPct: health.revenueGrowthYoyPct,
      netMarginPct: health.netMarginPct,
      operatingMarginPct: health.operatingMarginPct,
      marginTrend: health.marginTrend,
      offeringFilings12m: health.offeringFilings12m,
      insiderNetBuy90dUsd: health.insiderNetBuy90dUsd,
      insiderBuyCount90d: health.insiderBuyCount90d,
      insiderSellCount90d: health.insiderSellCount90d,
      topInstitutionalCount: health.topInstitutionalCount,
      warningsJson: health.warningsJson,
      summaryDataJson: health.summaryDataJson,
      computedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: companyHealthSnapshots.cik,
      set: {
        verdict: health.verdict,
        cashRunwayMonths: health.cashRunwayMonths,
        isCashFlowPositive: health.isCashFlowPositive,
        quarterlyBurnNative: health.quarterlyBurnNative,
        quarterlyBurnUsd: health.quarterlyBurnUsd,
        totalLiquidityNative: health.totalLiquidityNative,
        totalLiquidityUsd: health.totalLiquidityUsd,
        shareDilution1yPct: health.shareDilution1yPct,
        shareDilution3yPct: health.shareDilution3yPct,
        possibleReverseSplit: health.possibleReverseSplit,
        debtToCashRatio: health.debtToCashRatio,
        netCashUsd: health.netCashUsd,
        fcfTtmNative: health.fcfTtmNative,
        fcfTtmUsd: health.fcfTtmUsd,
        revenueTtmNative: health.revenueTtmNative,
        revenueTtmUsd: health.revenueTtmUsd,
        revenueGrowthYoyPct: health.revenueGrowthYoyPct,
        netMarginPct: health.netMarginPct,
        operatingMarginPct: health.operatingMarginPct,
        marginTrend: health.marginTrend,
        offeringFilings12m: health.offeringFilings12m,
        insiderNetBuy90dUsd: health.insiderNetBuy90dUsd,
        insiderBuyCount90d: health.insiderBuyCount90d,
        insiderSellCount90d: health.insiderSellCount90d,
        topInstitutionalCount: health.topInstitutionalCount,
        warningsJson: health.warningsJson,
        summaryDataJson: health.summaryDataJson,
        computedAt: new Date(),
      },
    });

  return health.isIndexable;
}

export async function runSampleIngestion(
  tickers: string[] = SAMPLE_TICKERS,
): Promise<{ processed: number; indexable: number; errors: number }> {
  const [run] = await db
    .insert(ingestionRuns)
    .values({ jobType: "sample", status: "running" })
    .returning({ id: ingestionRuns.id });

  const fxRates = await refreshFxRates();
  const allRows = await fetchCompanyTickersExchange();
  const byTicker = new Map<string, SecTickerExchangeRow>();
  for (const r of allRows) {
    if (!byTicker.has(r.ticker)) byTicker.set(r.ticker, r);
  }

  let processed = 0;
  let indexable = 0;
  let errors = 0;

  for (const rawTicker of tickers) {
    const ticker = rawTicker.toUpperCase();
    const row = byTicker.get(ticker);
    if (!row) {
      console.warn(`[ingest:sample] Ticker not found in SEC list: ${ticker}`);
      errors++;
      continue;
    }
    try {
      const [sub, facts] = await Promise.all([
        fetchSubmissions(row.cik),
        fetchCompanyFacts(row.cik),
      ]);
      if (!sub) {
        errors++;
        continue;
      }
      const isIdx = await upsertCompanyAndHealth({
        tickerRow: row,
        submissions: sub,
        facts,
        fxRates,
        fetchForm4s: true,
      });
      processed++;
      if (isIdx) indexable++;
      console.log(
        `[ingest:sample] ${ticker} (${row.cik}) -> indexable=${isIdx}`,
      );
    } catch (err) {
      errors++;
      console.error(`[ingest:sample] Error processing ${ticker}:`, err);
    }
  }

  await db
    .update(ingestionRuns)
    .set({
      status: "completed",
      processedCount: processed,
      errorCount: errors,
      detailsJson: { indexable, sampleSize: tickers.length },
      completedAt: new Date(),
    })
    .where(eq(ingestionRuns.id, run.id));

  return { processed, indexable, errors };
}

async function streamZipJsonEntries(
  zipPath: string,
  allowedCiks: Set<string>,
  onEntry: (cik: string, jsonText: string) => Promise<void>,
): Promise<{ processed: number; errors: number }> {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) {
        reject(err ?? new Error(`Cannot open ZIP ${zipPath}`));
        return;
      }
      let processed = 0;
      let errors = 0;

      zipfile.readEntry();
      zipfile.on("entry", (entry) => {
        const match = /CIK(\d{10})\.json$/i.exec(entry.fileName);
        if (!match || !allowedCiks.has(match[1])) {
          zipfile.readEntry();
          return;
        }
        const cik = match[1];
        zipfile.openReadStream(entry, (streamErr, readStream) => {
          if (streamErr || !readStream) {
            errors++;
            zipfile.readEntry();
            return;
          }
          const chunks: Buffer[] = [];
          readStream.on("data", (c: Buffer) => chunks.push(c));
          readStream.on("end", async () => {
            try {
              const txt = Buffer.concat(chunks).toString("utf8");
              await onEntry(cik, txt);
              processed++;
            } catch {
              errors++;
            }
            zipfile.readEntry();
          });
          readStream.on("error", () => {
            errors++;
            zipfile.readEntry();
          });
        });
      });

      zipfile.on("end", () => resolve({ processed, errors }));
      zipfile.on("error", reject);
    });
  });
}

export async function runBulkIngestion(): Promise<{
  processed: number;
  errors: number;
}> {
  const [run] = await db
    .insert(ingestionRuns)
    .values({ jobType: "bulk", status: "running" })
    .returning({ id: ingestionRuns.id });

  const cacheDir = getCacheDir();
  const fxRates = await refreshFxRates();
  const tickerRows = await fetchCompanyTickersExchange();

  // Deduplicate by CIK (keeping primary non-warrant ticker)
  const byCik = new Map<string, SecTickerExchangeRow>();
  for (const r of tickerRows) {
    const existing = byCik.get(r.cik);
    if (!existing) {
      byCik.set(r.cik, r);
    } else {
      const chosen = chooseCanonicalTicker([existing.ticker, r.ticker], existing.ticker);
      if (chosen === r.ticker) byCik.set(r.cik, r);
    }
  }
  const trackedCiks = new Set(byCik.keys());

  console.log(`[ingest:bulk] Downloading submissions.zip & companyfacts.zip...`);
  const [subZipPath, factsZipPath] = await Promise.all([
    downloadFileIfStale(
      "https://www.sec.gov/Archives/edgar/daily-index/bulkdata/submissions.zip",
      path.join(cacheDir, "submissions.zip"),
      20,
    ),
    downloadFileIfStale(
      "https://www.sec.gov/Archives/edgar/daily-index/xbrl/companyfacts.zip",
      path.join(cacheDir, "companyfacts.zip"),
      20,
    ),
  ]);

  // Pass 1: Stream submissions.zip -> upsert companies & recent filings
  console.log(`[ingest:bulk] Streaming submissions.zip for ${trackedCiks.size} CIKs...`);
  const subStats = await streamZipJsonEntries(
    subZipPath,
    trackedCiks,
    async (cik, jsonText) => {
      const sub = JSON.parse(jsonText) as SecSubmissionsJson;
      const row = byCik.get(cik)!;
      const allTickers = Array.from(
        new Set(
          [row.ticker, ...(sub.tickers ?? [])].map((t) => t.toUpperCase()).filter(Boolean),
        ),
      );
      const canonicalTicker = chooseCanonicalTicker(allTickers, row.ticker);
      const { filings, lastFilingDate } = extractRecentFilings(cik, sub);

      await db
        .insert(companies)
        .values({
          cik,
          ticker: canonicalTicker,
          allTickers,
          name: sub.name || row.name,
          exchange: row.exchange ?? sub.exchanges?.[0] ?? null,
          sic: sub.sic || null,
          sicDescription: sub.sicDescription || null,
          entityClass: "operating",
          filerCategory: sub.category || null,
          fiscalYearEnd: sub.fiscalYearEnd || null,
          stateOfIncorporation: sub.stateOfIncorporation || null,
          reportingCurrency: "USD",
          isIndexable: false,
          periodsCount: 0,
          lastFilingDate,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: companies.cik,
          set: {
            ticker: canonicalTicker,
            allTickers,
            name: sub.name || row.name,
            exchange: row.exchange ?? sub.exchanges?.[0] ?? null,
            sic: sub.sic || null,
            sicDescription: sub.sicDescription || null,
            filerCategory: sub.category || null,
            fiscalYearEnd: sub.fiscalYearEnd || null,
            stateOfIncorporation: sub.stateOfIncorporation || null,
            lastFilingDate,
            updatedAt: new Date(),
          },
        });

      if (filings.length > 0) {
        await db
          .insert(recentFilings)
          .values(filings)
          .onConflictDoNothing({ target: recentFilings.accn });
      }
    },
  );

  // Pass 2: Stream companyfacts.zip -> normalize & compute health snapshots
  console.log(`[ingest:bulk] Streaming companyfacts.zip...`);
  const factsStats = await streamZipJsonEntries(
    factsZipPath,
    trackedCiks,
    async (cik, jsonText) => {
      const facts = JSON.parse(jsonText) as SecCompanyFactsJson;
      const row = byCik.get(cik)!;
      const [comp] = await db
        .select()
        .from(companies)
        .where(eq(companies.cik, cik))
        .limit(1);
      if (!comp) return;

      const normalized = normalizeCompanyFacts(facts);
      const allPeriods = [...normalized.annual, ...normalized.quarterly];
      for (const p of allPeriods) {
        await db
          .insert(financialPeriods)
          .values({ cik, ...p })
          .onConflictDoUpdate({
            target: [
              financialPeriods.cik,
              financialPeriods.periodType,
              financialPeriods.periodEnd,
            ],
            set: {
              fiscalYear: p.fiscalYear,
              fiscalPeriod: p.fiscalPeriod,
              currency: p.currency,
              revenue: p.revenue,
              grossProfit: p.grossProfit,
              operatingIncome: p.operatingIncome,
              netIncome: p.netIncome,
              cashAndEquivalents: p.cashAndEquivalents,
              shortTermInvestments: p.shortTermInvestments,
              totalLiquidity: p.totalLiquidity,
              operatingCashFlow: p.operatingCashFlow,
              capex: p.capex,
              freeCashFlow: p.freeCashFlow,
              totalDebt: p.totalDebt,
              sharesOutstanding: p.sharesOutstanding,
              isDecumulated: p.isDecumulated,
              provenanceJson: p.provenanceJson,
            },
          });
      }

      const cutoff12m = new Date(Date.now() - 365 * 86_400_000)
        .toISOString()
        .slice(0, 10);
      const recentRows = await db
        .select({
          form: recentFilings.form,
          filingDate: recentFilings.filingDate,
          isDilutionFiling: recentFilings.isDilutionFiling,
        })
        .from(recentFilings)
        .where(eq(recentFilings.cik, cik));

      const forms = Array.from(new Set(recentRows.map((r) => r.form)));
      const offeringFilings12m = recentRows.filter(
        (r) => r.isDilutionFiling && r.filingDate >= cutoff12m,
      ).length;

      const [insiderStats, instCount] = await Promise.all([
        getInsiderStats90d(cik),
        getTopInstitutionalCount(cik),
      ]);

      const health = computeHealthSnapshot({
        cik,
        ticker: comp.ticker,
        name: comp.name || row.name,
        sic: comp.sic,
        taxonomies: normalized.taxonomies,
        forms,
        currency: normalized.currency,
        fxRatePerUsd: fxRates.get(normalized.currency) ?? 1,
        annual: normalized.annual,
        quarterly: normalized.quarterly,
        offeringFilings12m,
        insiderBuyCount90d: insiderStats.buyCount,
        insiderSellCount90d: insiderStats.sellCount,
        insiderNetBuy90dUsd: insiderStats.netBuyUsd,
        topInstitutionalCount: instCount,
      });

      await db
        .update(companies)
        .set({
          entityClass: health.entityClass,
          reportingCurrency: normalized.currency,
          periodsCount: allPeriods.length,
          isIndexable: health.isIndexable,
          updatedAt: new Date(),
        })
        .where(eq(companies.cik, cik));

      await db
        .insert(companyHealthSnapshots)
        .values({
          cik,
          verdict: health.verdict,
          cashRunwayMonths: health.cashRunwayMonths,
          isCashFlowPositive: health.isCashFlowPositive,
          quarterlyBurnNative: health.quarterlyBurnNative,
          quarterlyBurnUsd: health.quarterlyBurnUsd,
          totalLiquidityNative: health.totalLiquidityNative,
          totalLiquidityUsd: health.totalLiquidityUsd,
          shareDilution1yPct: health.shareDilution1yPct,
          shareDilution3yPct: health.shareDilution3yPct,
          possibleReverseSplit: health.possibleReverseSplit,
          debtToCashRatio: health.debtToCashRatio,
          netCashUsd: health.netCashUsd,
          fcfTtmNative: health.fcfTtmNative,
          fcfTtmUsd: health.fcfTtmUsd,
          revenueTtmNative: health.revenueTtmNative,
          revenueTtmUsd: health.revenueTtmUsd,
          revenueGrowthYoyPct: health.revenueGrowthYoyPct,
          netMarginPct: health.netMarginPct,
          operatingMarginPct: health.operatingMarginPct,
          marginTrend: health.marginTrend,
          offeringFilings12m: health.offeringFilings12m,
          insiderNetBuy90dUsd: health.insiderNetBuy90dUsd,
          insiderBuyCount90d: health.insiderBuyCount90d,
          insiderSellCount90d: health.insiderSellCount90d,
          topInstitutionalCount: health.topInstitutionalCount,
          warningsJson: health.warningsJson,
          summaryDataJson: health.summaryDataJson,
          computedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: companyHealthSnapshots.cik,
          set: {
            verdict: health.verdict,
            cashRunwayMonths: health.cashRunwayMonths,
            isCashFlowPositive: health.isCashFlowPositive,
            quarterlyBurnNative: health.quarterlyBurnNative,
            quarterlyBurnUsd: health.quarterlyBurnUsd,
            totalLiquidityNative: health.totalLiquidityNative,
            totalLiquidityUsd: health.totalLiquidityUsd,
            shareDilution1yPct: health.shareDilution1yPct,
            shareDilution3yPct: health.shareDilution3yPct,
            possibleReverseSplit: health.possibleReverseSplit,
            debtToCashRatio: health.debtToCashRatio,
            netCashUsd: health.netCashUsd,
            fcfTtmNative: health.fcfTtmNative,
            fcfTtmUsd: health.fcfTtmUsd,
            revenueTtmNative: health.revenueTtmNative,
            revenueTtmUsd: health.revenueTtmUsd,
            revenueGrowthYoyPct: health.revenueGrowthYoyPct,
            netMarginPct: health.netMarginPct,
            operatingMarginPct: health.operatingMarginPct,
            marginTrend: health.marginTrend,
            offeringFilings12m: health.offeringFilings12m,
            insiderNetBuy90dUsd: health.insiderNetBuy90dUsd,
            insiderBuyCount90d: health.insiderBuyCount90d,
            insiderSellCount90d: health.insiderSellCount90d,
            topInstitutionalCount: health.topInstitutionalCount,
            warningsJson: health.warningsJson,
            summaryDataJson: health.summaryDataJson,
            computedAt: new Date(),
          },
        });
    },
  );

  await db
    .update(ingestionRuns)
    .set({
      status: "completed",
      processedCount: factsStats.processed,
      errorCount: subStats.errors + factsStats.errors,
      detailsJson: { subProcessed: subStats.processed },
      completedAt: new Date(),
    })
    .where(eq(ingestionRuns.id, run.id));

  return {
    processed: factsStats.processed,
    errors: subStats.errors + factsStats.errors,
  };
}

export async function runDailyForm4Ingestion(
  lookbackDays = 3,
): Promise<{ fetched: number }> {
  const trackedRows = await db.select({ cik: companies.cik }).from(companies);
  const trackedCiks = new Set(trackedRows.map((r) => r.cik));
  if (trackedCiks.size === 0) return { fetched: 0 };

  let fetched = 0;
  for (let d = 0; d < lookbackDays; d++) {
    const dt = new Date(Date.now() - d * 86_400_000);
    const ymd = dt.toISOString().slice(0, 10).replace(/-/g, "");
    const idxText = await fetchDailyFormIndex(ymd);
    if (!idxText) continue;

    const form4Rows = parseDailyFormIndexForForm4(idxText).filter((r) =>
      trackedCiks.has(r.cik),
    );
    for (const row of form4Rows) {
      try {
        const sub = await fetchSubmissions(row.cik);
        const idx = sub?.filings.recent.accessionNumber.indexOf(row.accn) ?? -1;
        const primaryDoc =
          idx >= 0 ? sub!.filings.recent.primaryDocument[idx] : null;
        if (!primaryDoc) continue;
        const xml = await fetchForm4Xml(row.cik, row.accn, primaryDoc);
        if (!xml) continue;
        const txs = parseForm4Xml(xml, {
          cik: row.cik,
          accn: row.accn,
          filingDate: row.dateFiled,
          primaryDocument: primaryDoc,
        });
        if (txs.length > 0) {
          await db
            .insert(insiderTransactions)
            .values(txs)
            .onConflictDoNothing();
          fetched += txs.length;
        }
      } catch {
        // Continue on individual Form 4 error
      }
    }
  }

  return { fetched };
}

export async function runQuarterly13fIngestion(): Promise<{
  holdingsUpserted: number;
}> {
  const zipUrl = await discoverLatestDera13fZipUrl();
  if (!zipUrl) {
    throw new Error("Could not discover DERA 13F ZIP URL");
  }
  const cacheDir = getCacheDir();
  const zipName = path.basename(new URL(zipUrl).pathname);
  const zipPath = await downloadFileIfStale(
    zipUrl,
    path.join(cacheDir, zipName),
    24 * 14,
  );

  // Parse all rows then resolve top CUSIPs via OpenFIGI for tracked companies
  const allRows = await parseDera13fZip(zipPath, new Set());
  const uniqueCusips = Array.from(new Set(allRows.map((r) => r.cusip)));
  const cusipToCompany = await resolveCusipsViaOpenFigi(uniqueCusips);

  // Group top 30 holdings per company by value
  const byCik = new Map<string, typeof allRows>();
  for (const r of allRows) {
    const mapped = cusipToCompany.get(r.cusip);
    if (!mapped?.cik) continue;
    const arr = byCik.get(mapped.cik) ?? [];
    arr.push(r);
    byCik.set(mapped.cik, arr);
  }

  let holdingsUpserted = 0;
  for (const [cik, list] of byCik.entries()) {
    const top = list
      .sort((a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0))
      .slice(0, 30);
    for (const h of top) {
      await db
        .insert(institutionalHoldings)
        .values({
          cik,
          quarterEnd: h.quarterEnd,
          managerCik: h.managerCik,
          managerName: h.managerName,
          cusip: h.cusip,
          shares: h.shares,
          valueUsd: h.valueUsd,
          putCall: h.putCall,
          filingAccn: h.filingAccn,
        })
        .onConflictDoNothing();
      holdingsUpserted++;
    }
  }

  // Ensure cache dir exists for future runs
  fs.mkdirSync(cacheDir, { recursive: true });
  return { holdingsUpserted };
}
