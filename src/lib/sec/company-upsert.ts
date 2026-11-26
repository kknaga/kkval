import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  companies,
  companyHealthSnapshots,
  financialPeriods,
  insiderTransactions,
  institutionalHoldings,
  recentFilings,
  type NewRecentFilingRow,
} from "@/db/schema";
import { computeHealthSnapshot } from "@/lib/health/compute";
import {
  fetchForm4Xml,
  padCik,
  type SecCompanyFactsJson,
  type SecSubmissionsJson,
  type SecTickerExchangeRow,
} from "@/lib/sec/client";
import { parseForm4Xml, type ParsedForm4Transaction } from "@/lib/sec/form4";
import { normalizeCompanyFacts } from "@/lib/sec/xbrl-normalizer";

export const DILUTION_FORMS = new Set([
  "S-3",
  "S-3ASR",
  "424B5",
  "424B3",
  "S-1",
  "F-3",
  "F-1",
]);

export interface Form4FilingRef {
  accn: string;
  filingDate: string;
  primaryDocument: string;
}

export function chooseCanonicalTicker(
  tickers: string[],
  fallbackTicker: string,
): string {
  if (tickers.length === 0) return fallbackTicker.toUpperCase();
  const upper = tickers.map((t) => t.toUpperCase());
  const sorted = [...upper].sort((a, b) => {
    const aWarrant = a.length >= 5 && /[WRU]$/.test(a) ? 1 : 0;
    const bWarrant = b.length >= 5 && /[WRU]$/.test(b) ? 1 : 0;
    if (aWarrant !== bWarrant) return aWarrant - bWarrant;
    if (a.length !== b.length) return a.length - b.length;
    return a.localeCompare(b);
  });
  return sorted[0];
}

export function extractRecentFilings(
  cik: string,
  sub: SecSubmissionsJson,
  limit = 60,
): {
  filings: NewRecentFilingRow[];
  forms: string[];
  offeringFilings12m: number;
  lastFilingDate: string | null;
  form4Entries: Form4FilingRef[];
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
  const form4Entries: Form4FilingRef[] = [];
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

export async function getInsiderStats90d(cik: string): Promise<{
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

export async function getTopInstitutionalCount(cik: string): Promise<number> {
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

export async function ingestForm4EntriesForCik(
  cik: string,
  form4Entries: Form4FilingRef[],
  maxCount = 10,
): Promise<number> {
  if (form4Entries.length === 0) return 0;
  const parsedTxs: ParsedForm4Transaction[] = [];

  for (const f4 of form4Entries.slice(0, maxCount)) {
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
  return parsedTxs.length;
}

export async function upsertCompanyAndHealth(params: {
  tickerRow: SecTickerExchangeRow;
  submissions: SecSubmissionsJson;
  facts: SecCompanyFactsJson | null;
  fxRates: Map<string, number>;
  fetchForm4s?: boolean;
}): Promise<{ isIndexable: boolean; form4Entries: Form4FilingRef[] }> {
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

  if (filings.length > 0) {
    await db
      .insert(recentFilings)
      .values(filings)
      .onConflictDoNothing({ target: recentFilings.accn });
  }

  if (params.fetchForm4s && form4Entries.length > 0) {
    await ingestForm4EntriesForCik(cik, form4Entries, 10);
  }

  const allPeriods = [...normalized.annual, ...normalized.quarterly];
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

  return { isIndexable: health.isIndexable, form4Entries };
}

export async function backfillCompanyForm4sAndRefreshHealth(params: {
  tickerRow: SecTickerExchangeRow;
  submissions: SecSubmissionsJson;
  facts: SecCompanyFactsJson | null;
  fxRates: Map<string, number>;
  form4Entries: Form4FilingRef[];
}): Promise<void> {
  const cik = padCik(params.tickerRow.cik);
  const inserted = await ingestForm4EntriesForCik(cik, params.form4Entries, 10);
  if (inserted > 0) {
    await upsertCompanyAndHealth({
      tickerRow: params.tickerRow,
      submissions: params.submissions,
      facts: params.facts,
      fxRates: params.fxRates,
      fetchForm4s: false,
    });
  }
}
