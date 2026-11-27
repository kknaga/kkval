import { ensureCompanyIngested } from "@/lib/sec/on-demand";
import { and, asc, desc, eq, gte, ilike, isNotNull, lt, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  companies,
  companyHealthSnapshots,
  financialPeriods,
  insiderTransactions,
  institutionalHoldings,
  recentFilings,
  type CompanyHealthSnapshotRow,
  type CompanyRow,
  type FinancialPeriodRow,
  type InsiderTransactionRow,
  type InstitutionalHoldingRow,
  type RecentFilingRow,
} from "@/db/schema";

export type ScreenerSlug =
  | "small-caps-under-12-months-cash"
  | "highest-share-dilution-small-caps"
  | "cash-rich-debt-free-small-caps"
  | "recent-insider-buying-small-caps"
  | "positive-free-cash-flow-small-caps"
  | "foreign-adrs-financial-health";

export const SCREENER_SLUGS: readonly ScreenerSlug[] = [
  "small-caps-under-12-months-cash",
  "highest-share-dilution-small-caps",
  "cash-rich-debt-free-small-caps",
  "recent-insider-buying-small-caps",
  "positive-free-cash-flow-small-caps",
  "foreign-adrs-financial-health",
] as const;

export interface CompanyWithSnapshot {
  company: CompanyRow;
  snapshot: CompanyHealthSnapshotRow;
}

export interface FullCompanyProfile {
  company: CompanyRow;
  snapshot: CompanyHealthSnapshotRow | null;
  annual: FinancialPeriodRow[];
  quarterly: FinancialPeriodRow[];
  insiders: InsiderTransactionRow[];
  institutions: InstitutionalHoldingRow[];
  filings: RecentFilingRow[];
  peers: Array<{ ticker: string; name: string }>;
}

export async function searchCompanies(
  query: string,
  limit = 10,
): Promise<Array<{ ticker: string; name: string; exchange: string | null }>> {
  const q = query.trim();
  if (!q) return [];
  const upper = q.toUpperCase();
  try {
    const rows = await db
      .select({
        ticker: companies.ticker,
        name: companies.name,
        exchange: companies.exchange,
      })
      .from(companies)
      .where(
        or(
          ilike(companies.ticker, `${upper}%`),
          ilike(companies.name, `%${q}%`),
        ),
      )
      .orderBy(
        sql`CASE WHEN UPPER(${companies.ticker}) = ${upper} THEN 0 WHEN UPPER(${companies.ticker}) LIKE ${`${upper}%`} THEN 1 ELSE 2 END`,
        desc(companies.isIndexable),
        asc(companies.ticker),
      )
      .limit(limit);
    return rows;
  } catch {
    return [];
  }
}

async function queryCompanyByTickerOrAlias(
  rawTicker: string,
): Promise<CompanyRow | null> {
  const upper = rawTicker.trim().toUpperCase();
  if (!upper) return null;
  try {
    const [direct] = await db
      .select()
      .from(companies)
      .where(sql`UPPER(${companies.ticker}) = ${upper}`)
      .limit(1);
    if (direct) return direct;

    const [alias] = await db
      .select()
      .from(companies)
      .where(sql`${upper} = ANY(${companies.allTickers})`)
      .limit(1);
    return alias ?? null;
  } catch {
    return null;
  }
}

export async function findCompanyByTickerOrAlias(
  rawTicker: string,
  options: { allowOnDemand?: boolean } = {},
): Promise<CompanyRow | null> {
  const existing = await queryCompanyByTickerOrAlias(rawTicker);
  if (existing) return existing;
  if (!options.allowOnDemand) return null;

  const ingested = await ensureCompanyIngested(rawTicker);
  if (!ingested) return null;
  return queryCompanyByTickerOrAlias(rawTicker);
}

export async function getFullCompanyProfile(
  rawTicker: string,
  options: { allowOnDemand?: boolean } = {},
): Promise<FullCompanyProfile | null> {
  const company = await findCompanyByTickerOrAlias(rawTicker, options);
  if (!company) return null;

  try {
    const [
      snapshotRows,
      periodRows,
      insiderRows,
      latestInstQuarter,
      filingRows,
      peerRows,
    ] = await Promise.all([
      db
        .select()
        .from(companyHealthSnapshots)
        .where(eq(companyHealthSnapshots.cik, company.cik))
        .limit(1),
      db
        .select()
        .from(financialPeriods)
        .where(eq(financialPeriods.cik, company.cik))
        .orderBy(desc(financialPeriods.periodEnd)),
      db
        .select()
        .from(insiderTransactions)
        .where(eq(insiderTransactions.cik, company.cik))
        .orderBy(desc(insiderTransactions.filingDate), desc(insiderTransactions.id))
        .limit(35),
      db
        .select({ quarterEnd: institutionalHoldings.quarterEnd })
        .from(institutionalHoldings)
        .where(eq(institutionalHoldings.cik, company.cik))
        .orderBy(desc(institutionalHoldings.quarterEnd))
        .limit(1),
      db
        .select()
        .from(recentFilings)
        .where(eq(recentFilings.cik, company.cik))
        .orderBy(desc(recentFilings.filingDate))
        .limit(25),
      company.sic
        ? db
            .select({ ticker: companies.ticker, name: companies.name })
            .from(companies)
            .where(
              and(
                eq(companies.sic, company.sic),
                eq(companies.isIndexable, true),
                ne(companies.cik, company.cik),
              ),
            )
            .orderBy(desc(companies.periodsCount), asc(companies.ticker))
            .limit(6)
        : Promise.resolve([]),
    ]);

    const institutions = latestInstQuarter[0]
      ? await db
          .select()
          .from(institutionalHoldings)
          .where(
            and(
              eq(institutionalHoldings.cik, company.cik),
              eq(
                institutionalHoldings.quarterEnd,
                latestInstQuarter[0].quarterEnd,
              ),
            ),
          )
          .orderBy(desc(institutionalHoldings.valueUsd))
          .limit(25)
      : [];

    const peers: Array<{ ticker: string; name: string }> = [...peerRows];
    if (peers.length < 4) {
      const extra = await db
        .select({ ticker: companies.ticker, name: companies.name })
        .from(companies)
        .where(
          and(
            eq(companies.entityClass, company.entityClass),
            eq(companies.isIndexable, true),
            ne(companies.cik, company.cik),
          ),
        )
        .orderBy(desc(companies.periodsCount), asc(companies.ticker))
        .limit(6 - peers.length);
      const seen = new Set(peers.map((p) => p.ticker));
      for (const e of extra) {
        if (!seen.has(e.ticker)) peers.push(e);
      }
    }

    return {
      company,
      snapshot: snapshotRows[0] ?? null,
      annual: periodRows.filter((p) => p.periodType === "annual"),
      quarterly: periodRows.filter((p) => p.periodType === "quarterly"),
      insiders: insiderRows,
      institutions,
      filings: filingRows,
      peers,
    };
  } catch {
    return null;
  }
}

export async function getHomePageData(): Promise<{
  totalIndexed: number;
  lowRunwayList: CompanyWithSnapshot[];
  recentBuys: Array<{
    ticker: string;
    companyName: string;
    ownerName: string;
    ownerTitle: string | null;
    filingDate: string;
    totalValueUsd: number | null;
    shares: number;
    sharesAfter: number | null;
  }>;
  popularTickers: Array<{ ticker: string; name: string }>;
}> {
  try {
    const [countRes, lowRunway, buys, popular] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(companies)
        .where(eq(companies.isIndexable, true)),
      db
        .select({ company: companies, snapshot: companyHealthSnapshots })
        .from(companyHealthSnapshots)
        .innerJoin(companies, eq(companyHealthSnapshots.cik, companies.cik))
        .where(
          and(
            eq(companies.isIndexable, true),
            ne(companies.entityClass, "spac"),
            ne(companies.entityClass, "financial"),
            isNotNull(companyHealthSnapshots.cashRunwayMonths),
            lt(companyHealthSnapshots.cashRunwayMonths, 12),
          ),
        )
        .orderBy(asc(companyHealthSnapshots.cashRunwayMonths))
        .limit(8),
      db
        .select({
          ticker: companies.ticker,
          companyName: companies.name,
          ownerName: insiderTransactions.ownerName,
          ownerTitle: insiderTransactions.ownerTitle,
          filingDate: insiderTransactions.filingDate,
          totalValueUsd: insiderTransactions.totalValueUsd,
          shares: insiderTransactions.shares,
          sharesAfter: insiderTransactions.sharesAfter,
        })
        .from(insiderTransactions)
        .innerJoin(companies, eq(insiderTransactions.cik, companies.cik))
        .where(
          and(
            eq(insiderTransactions.isOpenMarket, true),
            eq(insiderTransactions.transactionCode, "P"),
          ),
        )
        .orderBy(desc(insiderTransactions.filingDate), desc(insiderTransactions.totalValueUsd))
        .limit(8),
      db
        .select({ ticker: companies.ticker, name: companies.name })
        .from(companies)
        .where(eq(companies.isIndexable, true))
        .orderBy(desc(companies.periodsCount), asc(companies.ticker))
        .limit(12),
    ]);

    return {
      totalIndexed: countRes[0]?.count ?? 0,
      lowRunwayList: lowRunway,
      recentBuys: buys,
      popularTickers: popular,
    };
  } catch {
    return {
      totalIndexed: 0,
      lowRunwayList: [],
      recentBuys: [],
      popularTickers: [],
    };
  }
}

export async function getScreenerResults(
  slug: ScreenerSlug,
  limit = 100,
): Promise<CompanyWithSnapshot[]> {
  try {
    const base = db
      .select({ company: companies, snapshot: companyHealthSnapshots })
      .from(companyHealthSnapshots)
      .innerJoin(companies, eq(companyHealthSnapshots.cik, companies.cik));

    switch (slug) {
      case "small-caps-under-12-months-cash":
        return await base
          .where(
            and(
              eq(companies.isIndexable, true),
              ne(companies.entityClass, "spac"),
              ne(companies.entityClass, "financial"),
              isNotNull(companyHealthSnapshots.cashRunwayMonths),
              lt(companyHealthSnapshots.cashRunwayMonths, 12),
            ),
          )
          .orderBy(asc(companyHealthSnapshots.cashRunwayMonths))
          .limit(limit);

      case "highest-share-dilution-small-caps":
        return await base
          .where(
            and(
              eq(companies.isIndexable, true),
              eq(companyHealthSnapshots.possibleReverseSplit, false),
              isNotNull(companyHealthSnapshots.shareDilution1yPct),
              gte(companyHealthSnapshots.shareDilution1yPct, 5),
            ),
          )
          .orderBy(desc(companyHealthSnapshots.shareDilution1yPct))
          .limit(limit);

      case "cash-rich-debt-free-small-caps":
        return await base
          .where(
            and(
              eq(companies.isIndexable, true),
              ne(companies.entityClass, "financial"),
              eq(companyHealthSnapshots.isCashFlowPositive, true),
              gte(companyHealthSnapshots.netCashUsd, 0),
              or(
                sql`${companyHealthSnapshots.debtToCashRatio} IS NULL`,
                lt(companyHealthSnapshots.debtToCashRatio, 0.35),
              ),
            ),
          )
          .orderBy(desc(companyHealthSnapshots.netCashUsd))
          .limit(limit);

      case "recent-insider-buying-small-caps":
        return await base
          .where(
            and(
              eq(companies.isIndexable, true),
              gte(companyHealthSnapshots.insiderBuyCount90d, 1),
              gte(companyHealthSnapshots.insiderNetBuy90dUsd, 0),
            ),
          )
          .orderBy(desc(companyHealthSnapshots.insiderNetBuy90dUsd))
          .limit(limit);

      case "positive-free-cash-flow-small-caps":
        return await base
          .where(
            and(
              eq(companies.isIndexable, true),
              isNotNull(companyHealthSnapshots.fcfTtmUsd),
              gte(companyHealthSnapshots.fcfTtmUsd, 1),
            ),
          )
          .orderBy(desc(companyHealthSnapshots.fcfTtmUsd))
          .limit(limit);

      case "foreign-adrs-financial-health":
        return await base
          .where(
            and(
              eq(companies.isIndexable, true),
              eq(companies.entityClass, "foreign"),
            ),
          )
          .orderBy(desc(companyHealthSnapshots.revenueTtmUsd))
          .limit(limit);
    }
  } catch {
    return [];
  }
}

export async function getIndexableTickersChunk(
  offset: number,
  limit: number,
): Promise<Array<{ ticker: string; updatedAt: Date }>> {
  try {
    return await db
      .select({ ticker: companies.ticker, updatedAt: companies.updatedAt })
      .from(companies)
      .where(eq(companies.isIndexable, true))
      .orderBy(asc(companies.ticker))
      .offset(offset)
      .limit(limit);
  } catch {
    return [];
  }
}

export async function getIndexableCount(): Promise<number> {
  try {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(companies)
      .where(eq(companies.isIndexable, true));
    return row?.count ?? 0;
  } catch {
    return 0;
  }
}

export async function getCuratedPeerPairs(
  maxPairs = 250,
): Promise<Array<{ a: string; b: string }>> {
  try {
    const rows = await db
      .select({
        ticker: companies.ticker,
        sic: companies.sic,
        entityClass: companies.entityClass,
      })
      .from(companies)
      .where(eq(companies.isIndexable, true))
      .orderBy(desc(companies.periodsCount), asc(companies.ticker))
      .limit(400);

    const byGroup = new Map<string, string[]>();
    for (const r of rows) {
      const key = r.sic || r.entityClass;
      const arr = byGroup.get(key) ?? [];
      arr.push(r.ticker);
      byGroup.set(key, arr);
    }

    const pairs: Array<{ a: string; b: string }> = [];
    const seen = new Set<string>();
    for (const group of byGroup.values()) {
      for (let i = 0; i < Math.min(group.length, 6) - 1; i++) {
        for (let j = i + 1; j < Math.min(group.length, 6); j++) {
          const t1 = group[i];
          const t2 = group[j];
          const [a, b] = t1 <= t2 ? [t1, t2] : [t2, t1];
          const key = `${a}|${b}`;
          if (!seen.has(key)) {
            seen.add(key);
            pairs.push({ a, b });
            if (pairs.length >= maxPairs) return pairs;
          }
        }
      }
    }
    return pairs;
  } catch {
    return [];
  }
}
