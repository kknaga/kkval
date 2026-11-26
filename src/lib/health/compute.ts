import type {
  EntityClass,
  HealthSummaryData,
  HealthVerdict,
  HealthWarning,
  MarginTrend,
} from "@/db/schema";
import type { NormalizedPeriod } from "@/lib/sec/xbrl-normalizer";

export interface HealthSnapshotInput {
  cik: string;
  ticker: string;
  name: string;
  sic: string | null;
  taxonomies: string[];
  forms: string[];
  currency: string;
  fxRatePerUsd: number; // units of reporting currency per 1 USD (e.g., 1 for USD, 0.91 for EUR)
  annual: NormalizedPeriod[];
  quarterly: NormalizedPeriod[];
  offeringFilings12m: number;
  insiderBuyCount90d: number;
  insiderSellCount90d: number;
  insiderNetBuy90dUsd: number | null;
  topInstitutionalCount: number;
}

export interface ComputedHealthSnapshot {
  entityClass: EntityClass;
  isIndexable: boolean;
  verdict: HealthVerdict;
  cashRunwayMonths: number | null;
  isCashFlowPositive: boolean | null;
  quarterlyBurnNative: number | null;
  quarterlyBurnUsd: number | null;
  totalLiquidityNative: number | null;
  totalLiquidityUsd: number | null;
  shareDilution1yPct: number | null;
  shareDilution3yPct: number | null;
  possibleReverseSplit: boolean;
  debtToCashRatio: number | null;
  netCashUsd: number | null;
  fcfTtmNative: number | null;
  fcfTtmUsd: number | null;
  revenueTtmNative: number | null;
  revenueTtmUsd: number | null;
  revenueGrowthYoyPct: number | null;
  netMarginPct: number | null;
  operatingMarginPct: number | null;
  marginTrend: MarginTrend;
  offeringFilings12m: number;
  insiderNetBuy90dUsd: number | null;
  insiderBuyCount90d: number;
  insiderSellCount90d: number;
  topInstitutionalCount: number;
  warningsJson: HealthWarning[];
  summaryDataJson: HealthSummaryData;
}

export function classifyEntity(
  sic: string | null | undefined,
  taxonomies: string[],
  forms: string[],
): EntityClass {
  const sicNum = sic ? Number.parseInt(sic, 10) : NaN;
  if (sicNum === 6770 || taxonomies.includes("spac")) {
    return "spac";
  }
  if (Number.isFinite(sicNum) && sicNum >= 6000 && sicNum <= 6499) {
    return "financial";
  }
  if (sicNum === 6798) {
    return "reit";
  }
  if (Number.isFinite(sicNum) && sicNum >= 2833 && sicNum <= 2836) {
    return "biotech";
  }
  if (forms.some((f) => f === "20-F" || f === "20-F/A" || f === "40-F")) {
    return "foreign";
  }
  return "operating";
}

function toUsd(val: number | null, ratePerUsd: number): number | null {
  if (val === null || !Number.isFinite(val)) return null;
  const safeRate = ratePerUsd > 0 ? ratePerUsd : 1;
  return val / safeRate;
}

function sumLatest4(
  quarterly: NormalizedPeriod[],
  annual: NormalizedPeriod[],
  pick: (p: NormalizedPeriod) => number | null,
): number | null {
  const qVals = quarterly
    .slice(0, 4)
    .map(pick)
    .filter((v): v is number => v !== null && Number.isFinite(v));
  if (qVals.length === 4) {
    return qVals.reduce((acc, v) => acc + v, 0);
  }
  const latestAnnual = annual.find((p) => pick(p) !== null);
  if (latestAnnual) {
    return pick(latestAnnual);
  }
  if (qVals.length > 0) {
    // Annualize partial quarters
    const avg = qVals.reduce((a, b) => a + b, 0) / qVals.length;
    return avg * 4;
  }
  return null;
}

function findShareComparison(
  periods: NormalizedPeriod[],
  latestEnd: string,
  targetYearsAgo: number,
): number | null {
  const latestTs = Date.parse(latestEnd);
  if (!Number.isFinite(latestTs)) return null;
  const targetTs = latestTs - targetYearsAgo * 365.25 * 86_400_000;
  let best: { diff: number; val: number } | null = null;
  for (const p of periods) {
    if (p.sharesOutstanding === null || p.sharesOutstanding <= 0) continue;
    const ts = Date.parse(p.periodEnd);
    if (!Number.isFinite(ts)) continue;
    const diff = Math.abs(ts - targetTs);
    // Must be within +/- 120 days of target lookback
    if (diff <= 120 * 86_400_000 && (!best || diff < best.diff)) {
      best = { diff, val: p.sharesOutstanding };
    }
  }
  return best?.val ?? null;
}

function detectReverseSplit(periods: NormalizedPeriod[]): boolean {
  const withShares = periods
    .filter((p) => p.sharesOutstanding !== null && p.sharesOutstanding > 0)
    .slice(0, 12);
  for (let i = 0; i < withShares.length - 1; i++) {
    const newer = withShares[i].sharesOutstanding!;
    const older = withShares[i + 1].sharesOutstanding!;
    // Abrupt >= 40% share drop in a single reporting step indicates a reverse split
    if ((newer - older) / older <= -0.4) {
      return true;
    }
  }
  return false;
}

export function computeHealthSnapshot(
  input: HealthSnapshotInput,
): ComputedHealthSnapshot {
  const entityClass = classifyEntity(input.sic, input.taxonomies, input.forms);
  const allCombined = [...input.quarterly, ...input.annual].sort((a, b) =>
    a.periodEnd < b.periodEnd ? 1 : -1,
  );
  const latest = allCombined[0] ?? null;

  const latestLiquidityNative =
    allCombined.find((p) => p.totalLiquidity !== null)?.totalLiquidity ?? null;
  const latestDebtNative =
    allCombined.find((p) => p.totalDebt !== null)?.totalDebt ?? null;
  const latestShares =
    allCombined.find((p) => p.sharesOutstanding !== null && p.sharesOutstanding > 0) ?? null;

  const ocfTtmNative = sumLatest4(
    input.quarterly,
    input.annual,
    (p) => p.operatingCashFlow,
  );
  const fcfTtmNative = sumLatest4(
    input.quarterly,
    input.annual,
    (p) => p.freeCashFlow,
  );
  const revenueTtmNative = sumLatest4(
    input.quarterly,
    input.annual,
    (p) => p.revenue,
  );
  const netIncomeTtmNative = sumLatest4(
    input.quarterly,
    input.annual,
    (p) => p.netIncome,
  );
  const opIncomeTtmNative = sumLatest4(
    input.quarterly,
    input.annual,
    (p) => p.operatingIncome,
  );

  // Revenue YoY growth from latest 2 annual periods
  let revenueGrowthYoyPct: number | null = null;
  const revAnnuals = input.annual.filter(
    (p) => p.revenue !== null && p.revenue > 0,
  );
  if (revAnnuals.length >= 2) {
    const curr = revAnnuals[0].revenue!;
    const prev = revAnnuals[1].revenue!;
    revenueGrowthYoyPct = ((curr - prev) / Math.abs(prev)) * 100;
  }

  // Margins & margin trend
  const netMarginPct =
    revenueTtmNative && revenueTtmNative > 0 && netIncomeTtmNative !== null
      ? (netIncomeTtmNative / revenueTtmNative) * 100
      : null;
  const operatingMarginPct =
    revenueTtmNative && revenueTtmNative > 0 && opIncomeTtmNative !== null
      ? (opIncomeTtmNative / revenueTtmNative) * 100
      : null;

  let marginTrend: MarginTrend = "unknown";
  if (revAnnuals.length >= 2) {
    const a0 = revAnnuals[0];
    const a1 = revAnnuals[1];
    if (
      a0.netIncome !== null &&
      a1.netIncome !== null &&
      a0.revenue &&
      a1.revenue
    ) {
      const m0 = (a0.netIncome / a0.revenue) * 100;
      const m1 = (a1.netIncome / a1.revenue) * 100;
      const delta = m0 - m1;
      if (delta >= 2) marginTrend = "expanding";
      else if (delta <= -2) marginTrend = "compressing";
      else marginTrend = "stable";
    }
  }

  // Cash runway & quarterly burn
  let isCashFlowPositive: boolean | null = null;
  let cashRunwayMonths: number | null = null;
  let quarterlyBurnNative: number | null = null;

  if (entityClass !== "spac" && entityClass !== "financial" && ocfTtmNative !== null) {
    if (ocfTtmNative >= 0) {
      isCashFlowPositive = true;
      quarterlyBurnNative = 0;
    } else {
      isCashFlowPositive = false;
      quarterlyBurnNative = Math.abs(ocfTtmNative) / 4;
      if (latestLiquidityNative !== null && quarterlyBurnNative > 0) {
        cashRunwayMonths = (latestLiquidityNative / (Math.abs(ocfTtmNative) / 12));
      }
    }
  }

  // Share dilution
  const possibleReverseSplit = detectReverseSplit(allCombined);
  let shareDilution1yPct: number | null = null;
  let shareDilution3yPct: number | null = null;
  if (latestShares?.sharesOutstanding) {
    const s1 = findShareComparison(allCombined, latestShares.periodEnd, 1);
    if (s1 && s1 > 0) {
      shareDilution1yPct =
        ((latestShares.sharesOutstanding - s1) / s1) * 100;
    }
    const s3 = findShareComparison(allCombined, latestShares.periodEnd, 3);
    if (s3 && s3 > 0) {
      shareDilution3yPct =
        ((latestShares.sharesOutstanding - s3) / s3) * 100;
    }
  }

  const debtToCashRatio =
    entityClass !== "financial" &&
    latestDebtNative !== null &&
    latestLiquidityNative !== null &&
    latestLiquidityNative > 0
      ? latestDebtNative / latestLiquidityNative
      : null;

  const totalLiquidityUsd = toUsd(latestLiquidityNative, input.fxRatePerUsd);
  const quarterlyBurnUsd = toUsd(quarterlyBurnNative, input.fxRatePerUsd);
  const fcfTtmUsd = toUsd(fcfTtmNative, input.fxRatePerUsd);
  const revenueTtmUsd = toUsd(revenueTtmNative, input.fxRatePerUsd);
  const latestDebtUsd = toUsd(latestDebtNative, input.fxRatePerUsd);
  const netCashUsd =
    totalLiquidityUsd !== null
      ? totalLiquidityUsd - (latestDebtUsd ?? 0)
      : null;

  // Warnings & Verdict
  const warnings: HealthWarning[] = [];

  if (entityClass === "spac") {
    warnings.push({ code: "sector_excluded_spac", severity: "info" });
  } else if (entityClass === "financial") {
    warnings.push({ code: "sector_excluded_financial", severity: "info" });
  } else {
    if (cashRunwayMonths !== null) {
      if (cashRunwayMonths < 6) {
        warnings.push({
          code: "runway_critical",
          severity: "critical",
          params: { months: Math.round(cashRunwayMonths * 10) / 10 },
        });
      } else if (cashRunwayMonths < 12) {
        warnings.push({
          code: "runway_short",
          severity: "warn",
          params: { months: Math.round(cashRunwayMonths * 10) / 10 },
        });
      } else if (cashRunwayMonths < 24) {
        warnings.push({
          code: "runway_watch",
          severity: "info",
          params: { months: Math.round(cashRunwayMonths * 10) / 10 },
        });
      }
    } else if (isCashFlowPositive) {
      warnings.push({ code: "cash_flow_positive", severity: "good" });
    }
  }

  if (possibleReverseSplit) {
    warnings.push({ code: "possible_reverse_split", severity: "warn" });
  } else if (shareDilution1yPct !== null) {
    if (shareDilution1yPct >= 25) {
      warnings.push({
        code: "heavy_dilution",
        severity: "critical",
        params: { pct: Math.round(shareDilution1yPct * 10) / 10 },
      });
    } else if (shareDilution1yPct >= 10) {
      warnings.push({
        code: "moderate_dilution",
        severity: "warn",
        params: { pct: Math.round(shareDilution1yPct * 10) / 10 },
      });
    }
  }

  if (input.offeringFilings12m > 0) {
    warnings.push({
      code: "offering_filings_active",
      severity: input.offeringFilings12m >= 2 ? "warn" : "info",
      params: { count: input.offeringFilings12m },
    });
  }

  if (debtToCashRatio !== null && debtToCashRatio >= 2) {
    warnings.push({
      code: "high_debt_to_cash",
      severity: "warn",
      params: { ratio: Math.round(debtToCashRatio * 10) / 10 },
    });
  } else if (netCashUsd !== null && netCashUsd > 0 && isCashFlowPositive) {
    warnings.push({ code: "net_cash_surplus", severity: "good" });
  }

  if (marginTrend === "compressing") {
    warnings.push({ code: "margin_compressing", severity: "warn" });
  }

  if (input.insiderBuyCount90d >= 2 && (input.insiderNetBuy90dUsd ?? 0) > 50_000) {
    warnings.push({
      code: "insider_buying_cluster",
      severity: "good",
      params: { count: input.insiderBuyCount90d },
    });
  } else if (
    input.insiderSellCount90d >= 4 &&
    (input.insiderNetBuy90dUsd ?? 0) < -1_000_000
  ) {
    warnings.push({
      code: "insider_heavy_selling",
      severity: "info",
      params: { count: input.insiderSellCount90d },
    });
  }

  let verdict: HealthVerdict = "healthy";
  if (entityClass === "spac") {
    verdict = "excluded";
  } else if (
    (cashRunwayMonths !== null && cashRunwayMonths < 6) ||
    ((cashRunwayMonths !== null && cashRunwayMonths < 12) &&
      (shareDilution1yPct ?? 0) >= 25)
  ) {
    verdict = "critical";
  } else if (
    (cashRunwayMonths !== null && cashRunwayMonths < 12) ||
    (!possibleReverseSplit && (shareDilution1yPct ?? 0) >= 25) ||
    possibleReverseSplit
  ) {
    verdict = "high_risk";
  } else if (
    (cashRunwayMonths !== null && cashRunwayMonths < 24) ||
    (!possibleReverseSplit && (shareDilution1yPct ?? 0) >= 10) ||
    (debtToCashRatio !== null && debtToCashRatio >= 2.5)
  ) {
    verdict = "watch";
  }

  // Indexability gate: exclude SPACs and thin shells lacking >=2 periods & core metrics
  const distinctPeriods = input.annual.length + input.quarterly.length;
  const hasCoreMetricCount = [
    revenueTtmNative !== null,
    netIncomeTtmNative !== null,
    latestLiquidityNative !== null,
    ocfTtmNative !== null,
  ].filter(Boolean).length;

  const isIndexable =
    entityClass !== "spac" && distinctPeriods >= 2 && hasCoreMetricCount >= 2;

  return {
    entityClass,
    isIndexable,
    verdict,
    cashRunwayMonths,
    isCashFlowPositive,
    quarterlyBurnNative,
    quarterlyBurnUsd,
    totalLiquidityNative: latestLiquidityNative,
    totalLiquidityUsd,
    shareDilution1yPct,
    shareDilution3yPct,
    possibleReverseSplit,
    debtToCashRatio,
    netCashUsd,
    fcfTtmNative,
    fcfTtmUsd,
    revenueTtmNative,
    revenueTtmUsd,
    revenueGrowthYoyPct,
    netMarginPct,
    operatingMarginPct,
    marginTrend,
    offeringFilings12m: input.offeringFilings12m,
    insiderNetBuy90dUsd: input.insiderNetBuy90dUsd,
    insiderBuyCount90d: input.insiderBuyCount90d,
    insiderSellCount90d: input.insiderSellCount90d,
    topInstitutionalCount: input.topInstitutionalCount,
    warningsJson: warnings,
    summaryDataJson: {
      ticker: input.ticker,
      name: input.name,
      entityClass,
      currency: input.currency,
      latestPeriodEnd: latest?.periodEnd ?? null,
      totalLiquidityUsd,
      totalLiquidityNative: latestLiquidityNative,
      isCashFlowPositive,
      cashRunwayMonths,
      quarterlyBurnUsd,
      shareDilution1yPct,
      possibleReverseSplit,
      debtToCashRatio,
      fcfTtmUsd,
      offeringFilings12m: input.offeringFilings12m,
      insiderBuyCount90d: input.insiderBuyCount90d,
      insiderSellCount90d: input.insiderSellCount90d,
      insiderNetBuy90dUsd: input.insiderNetBuy90dUsd,
    },
  };
}
