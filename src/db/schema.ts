import { sql } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  smallint,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export type EntityClass =
  | "operating"
  | "biotech"
  | "financial"
  | "reit"
  | "spac"
  | "foreign";

export type HealthVerdict =
  | "healthy"
  | "watch"
  | "high_risk"
  | "critical"
  | "excluded";

export type MarginTrend = "expanding" | "stable" | "compressing" | "unknown";

export type PeriodType = "annual" | "quarterly";

export interface FactProvenance {
  tag: string;
  taxonomy: string;
  accn: string;
  form: string;
  filed: string;
  start?: string;
  end: string;
  val: number;
  unit: string;
  decumulatedFrom?: string[];
}

export type PeriodProvenanceMap = Partial<
  Record<
    | "revenue"
    | "grossProfit"
    | "operatingIncome"
    | "netIncome"
    | "cashAndEquivalents"
    | "shortTermInvestments"
    | "totalLiquidity"
    | "operatingCashFlow"
    | "capex"
    | "freeCashFlow"
    | "totalDebt"
    | "sharesOutstanding",
    FactProvenance
  >
>;

export type HealthWarningCode =
  | "runway_critical"
  | "runway_short"
  | "runway_watch"
  | "cash_flow_positive"
  | "heavy_dilution"
  | "moderate_dilution"
  | "possible_reverse_split"
  | "offering_filings_active"
  | "high_debt_to_cash"
  | "net_cash_surplus"
  | "margin_compressing"
  | "insider_buying_cluster"
  | "insider_heavy_selling"
  | "sector_excluded_spac"
  | "sector_excluded_financial";

export interface HealthWarning {
  code: HealthWarningCode;
  severity: "critical" | "warn" | "good" | "info";
  params?: Record<string, number | string>;
}

export interface HealthSummaryData {
  ticker: string;
  name: string;
  entityClass: EntityClass;
  currency: string;
  latestPeriodEnd: string | null;
  totalLiquidityUsd: number | null;
  totalLiquidityNative: number | null;
  isCashFlowPositive: boolean | null;
  cashRunwayMonths: number | null;
  quarterlyBurnUsd: number | null;
  shareDilution1yPct: number | null;
  possibleReverseSplit: boolean;
  debtToCashRatio: number | null;
  fcfTtmUsd: number | null;
  offeringFilings12m: number;
  insiderBuyCount90d: number;
  insiderSellCount90d: number;
  insiderNetBuy90dUsd: number | null;
}

export const companies = pgTable(
  "companies",
  {
    cik: text("cik").primaryKey(),
    ticker: text("ticker").notNull().unique(),
    allTickers: text("all_tickers").array().notNull().default(sql`'{}'::text[]`),
    name: text("name").notNull(),
    exchange: text("exchange"),
    sic: text("sic"),
    sicDescription: text("sic_description"),
    entityClass: text("entity_class").$type<EntityClass>().notNull().default("operating"),
    filerCategory: text("filer_category"),
    fiscalYearEnd: text("fiscal_year_end"),
    stateOfIncorporation: text("state_of_incorporation"),
    reportingCurrency: text("reporting_currency").notNull().default("USD"),
    isIndexable: boolean("is_indexable").notNull().default(false),
    periodsCount: integer("periods_count").notNull().default(0),
    lastFilingDate: text("last_filing_date"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("companies_ticker_lower_idx").on(sql`LOWER(${table.ticker})`),
    index("companies_indexable_class_idx").on(
      table.isIndexable,
      table.entityClass,
    ),
    index("companies_sic_idx").on(table.sic),
  ],
);

export const financialPeriods = pgTable(
  "financial_periods",
  {
    cik: text("cik")
      .notNull()
      .references(() => companies.cik, { onDelete: "cascade" }),
    periodType: text("period_type").$type<PeriodType>().notNull(),
    periodEnd: text("period_end").notNull(),
    fiscalYear: smallint("fiscal_year"),
    fiscalPeriod: text("fiscal_period"),
    currency: text("currency").notNull().default("USD"),
    revenue: doublePrecision("revenue"),
    grossProfit: doublePrecision("gross_profit"),
    operatingIncome: doublePrecision("operating_income"),
    netIncome: doublePrecision("net_income"),
    cashAndEquivalents: doublePrecision("cash_and_equivalents"),
    shortTermInvestments: doublePrecision("short_term_investments"),
    totalLiquidity: doublePrecision("total_liquidity"),
    operatingCashFlow: doublePrecision("operating_cash_flow"),
    capex: doublePrecision("capex"),
    freeCashFlow: doublePrecision("free_cash_flow"),
    totalDebt: doublePrecision("total_debt"),
    sharesOutstanding: doublePrecision("shares_outstanding"),
    isDecumulated: boolean("is_decumulated").notNull().default(false),
    provenanceJson: jsonb("provenance_json")
      .$type<PeriodProvenanceMap>()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.cik, table.periodType, table.periodEnd] }),
    index("financial_periods_cik_type_end_idx").on(
      table.cik,
      table.periodType,
      table.periodEnd,
    ),
  ],
);

export const companyHealthSnapshots = pgTable(
  "company_health_snapshots",
  {
    cik: text("cik")
      .primaryKey()
      .references(() => companies.cik, { onDelete: "cascade" }),
    verdict: text("verdict").$type<HealthVerdict>().notNull().default("watch"),
    cashRunwayMonths: doublePrecision("cash_runway_months"),
    isCashFlowPositive: boolean("is_cash_flow_positive"),
    quarterlyBurnNative: doublePrecision("quarterly_burn_native"),
    quarterlyBurnUsd: doublePrecision("quarterly_burn_usd"),
    totalLiquidityNative: doublePrecision("total_liquidity_native"),
    totalLiquidityUsd: doublePrecision("total_liquidity_usd"),
    shareDilution1yPct: doublePrecision("share_dilution_1y_pct"),
    shareDilution3yPct: doublePrecision("share_dilution_3y_pct"),
    possibleReverseSplit: boolean("possible_reverse_split")
      .notNull()
      .default(false),
    debtToCashRatio: doublePrecision("debt_to_cash_ratio"),
    netCashUsd: doublePrecision("net_cash_usd"),
    fcfTtmNative: doublePrecision("fcf_ttm_native"),
    fcfTtmUsd: doublePrecision("fcf_ttm_usd"),
    revenueTtmNative: doublePrecision("revenue_ttm_native"),
    revenueTtmUsd: doublePrecision("revenue_ttm_usd"),
    revenueGrowthYoyPct: doublePrecision("revenue_growth_yoy_pct"),
    netMarginPct: doublePrecision("net_margin_pct"),
    operatingMarginPct: doublePrecision("operating_margin_pct"),
    marginTrend: text("margin_trend")
      .$type<MarginTrend>()
      .notNull()
      .default("unknown"),
    offeringFilings12m: integer("offering_filings_12m").notNull().default(0),
    insiderNetBuy90dUsd: doublePrecision("insider_net_buy_90d_usd"),
    insiderBuyCount90d: integer("insider_buy_count_90d").notNull().default(0),
    insiderSellCount90d: integer("insider_sell_count_90d").notNull().default(0),
    topInstitutionalCount: integer("top_institutional_count")
      .notNull()
      .default(0),
    warningsJson: jsonb("warnings_json").$type<HealthWarning[]>().notNull(),
    summaryDataJson: jsonb("summary_data_json")
      .$type<HealthSummaryData>()
      .notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("health_runway_idx").on(table.cashRunwayMonths),
    index("health_dilution_idx").on(table.shareDilution1yPct),
    index("health_insider_net_idx").on(table.insiderNetBuy90dUsd),
    index("health_fcf_idx").on(table.fcfTtmUsd),
    index("health_debt_cash_idx").on(table.debtToCashRatio),
  ],
);

export const insiderTransactions = pgTable(
  "insider_transactions",
  {
    id: serial("id").primaryKey(),
    cik: text("cik")
      .notNull()
      .references(() => companies.cik, { onDelete: "cascade" }),
    accn: text("accn").notNull(),
    filingDate: text("filing_date").notNull(),
    transactionDate: text("transaction_date").notNull().default(""),
    ownerName: text("owner_name").notNull(),
    ownerTitle: text("owner_title"),
    isDirector: boolean("is_director").notNull().default(false),
    isOfficer: boolean("is_officer").notNull().default(false),
    isTenPercentOwner: boolean("is_ten_percent_owner").notNull().default(false),
    transactionCode: text("transaction_code").notNull(),
    acquiredDisposed: text("acquired_disposed"),
    shares: doublePrecision("shares").notNull().default(0),
    pricePerShare: doublePrecision("price_per_share").notNull().default(0),
    totalValueUsd: doublePrecision("total_value_usd"),
    sharesAfter: doublePrecision("shares_after"),
    isOpenMarket: boolean("is_open_market").notNull().default(false),
    primaryDocument: text("primary_document"),
  },
  (table) => [
    uniqueIndex("insider_tx_dedupe_uidx").on(
      table.accn,
      table.ownerName,
      table.transactionDate,
      table.transactionCode,
      table.shares,
      table.pricePerShare,
    ),
    index("insider_tx_cik_filing_idx").on(table.cik, table.filingDate),
  ],
);

export const cusipMap = pgTable("cusip_map", {
  cusip: text("cusip").primaryKey(),
  cik: text("cik"),
  ticker: text("ticker"),
  issuerName: text("issuer_name"),
  securityType: text("security_type"),
  source: text("source").notNull().default("openfigi"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const institutionalHoldings = pgTable(
  "institutional_holdings",
  {
    id: serial("id").primaryKey(),
    cik: text("cik")
      .notNull()
      .references(() => companies.cik, { onDelete: "cascade" }),
    quarterEnd: text("quarter_end").notNull(),
    managerCik: text("manager_cik").notNull(),
    managerName: text("manager_name").notNull(),
    cusip: text("cusip").notNull(),
    shares: doublePrecision("shares"),
    valueUsd: doublePrecision("value_usd"),
    putCall: text("put_call").notNull().default(""),
    filingAccn: text("filing_accn"),
  },
  (table) => [
    uniqueIndex("inst_holdings_uidx").on(
      table.cik,
      table.quarterEnd,
      table.managerCik,
      table.cusip,
      table.putCall,
    ),
    index("inst_holdings_cik_q_val_idx").on(
      table.cik,
      table.quarterEnd,
      table.valueUsd,
    ),
  ],
);

export const recentFilings = pgTable(
  "recent_filings",
  {
    accn: text("accn").primaryKey(),
    cik: text("cik")
      .notNull()
      .references(() => companies.cik, { onDelete: "cascade" }),
    form: text("form").notNull(),
    filingDate: text("filing_date").notNull(),
    reportDate: text("report_date"),
    primaryDocument: text("primary_document"),
    description: text("description"),
    isDilutionFiling: boolean("is_dilution_filing").notNull().default(false),
  },
  (table) => [
    index("recent_filings_cik_date_idx").on(table.cik, table.filingDate),
  ],
);

export const fxRates = pgTable("fx_rates", {
  currency: text("currency").primaryKey(),
  ratePerUsd: doublePrecision("rate_per_usd").notNull(),
  asOfDate: text("as_of_date").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const ingestionRuns = pgTable("ingestion_runs", {
  id: serial("id").primaryKey(),
  jobType: text("job_type").notNull(),
  status: text("status").notNull(),
  processedCount: integer("processed_count").notNull().default(0),
  errorCount: integer("error_count").notNull().default(0),
  detailsJson: jsonb("details_json").$type<Record<string, unknown>>(),
  startedAt: timestamp("started_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export type CompanyRow = typeof companies.$inferSelect;
export type NewCompanyRow = typeof companies.$inferInsert;
export type FinancialPeriodRow = typeof financialPeriods.$inferSelect;
export type NewFinancialPeriodRow = typeof financialPeriods.$inferInsert;
export type CompanyHealthSnapshotRow = typeof companyHealthSnapshots.$inferSelect;
export type NewCompanyHealthSnapshotRow = typeof companyHealthSnapshots.$inferInsert;
export type InsiderTransactionRow = typeof insiderTransactions.$inferSelect;
export type NewInsiderTransactionRow = typeof insiderTransactions.$inferInsert;
export type InstitutionalHoldingRow = typeof institutionalHoldings.$inferSelect;
export type NewInstitutionalHoldingRow = typeof institutionalHoldings.$inferInsert;
export type RecentFilingRow = typeof recentFilings.$inferSelect;
export type NewRecentFilingRow = typeof recentFilings.$inferInsert;
