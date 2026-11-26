import type {
  FactProvenance,
  PeriodProvenanceMap,
  PeriodType,
} from "@/db/schema";
import type { SecCompanyFactsJson, SecFactEntry } from "./client";

export interface NormalizedPeriod {
  periodType: PeriodType;
  periodEnd: string;
  fiscalYear: number | null;
  fiscalPeriod: string | null;
  currency: string;
  revenue: number | null;
  grossProfit: number | null;
  operatingIncome: number | null;
  netIncome: number | null;
  cashAndEquivalents: number | null;
  shortTermInvestments: number | null;
  totalLiquidity: number | null;
  operatingCashFlow: number | null;
  capex: number | null;
  freeCashFlow: number | null;
  totalDebt: number | null;
  sharesOutstanding: number | null;
  isDecumulated: boolean;
  provenanceJson: PeriodProvenanceMap;
}

export interface NormalizationResult {
  currency: string;
  taxonomies: string[];
  annual: NormalizedPeriod[];
  quarterly: NormalizedPeriod[];
}

interface TagCandidate {
  taxonomy: string;
  tag: string;
}

const ALLOWED_FORMS = new Set([
  "10-K",
  "10-K/A",
  "10-Q",
  "10-Q/A",
  "20-F",
  "20-F/A",
  "40-F",
  "40-F/A",
  "6-K",
]);

const TAG_LISTS: Record<
  | "revenue"
  | "costOfRevenue"
  | "grossProfit"
  | "operatingIncome"
  | "netIncome"
  | "cashAndEquivalents"
  | "shortTermInvestments"
  | "combinedCashAndShortTerm"
  | "operatingCashFlow"
  | "capex"
  | "debtCombined"
  | "debtNoncurrent"
  | "debtCurrent"
  | "sharesOutstanding",
  TagCandidate[]
> = {
  revenue: [
    { taxonomy: "us-gaap", tag: "RevenueFromContractWithCustomerExcludingAssessedTax" },
    { taxonomy: "us-gaap", tag: "Revenues" },
    { taxonomy: "us-gaap", tag: "RevenueFromContractWithCustomerIncludingAssessedTax" },
    { taxonomy: "us-gaap", tag: "SalesRevenueNet" },
    { taxonomy: "us-gaap", tag: "SalesRevenueGoodsNet" },
    { taxonomy: "us-gaap", tag: "SalesRevenueServicesNet" },
    { taxonomy: "us-gaap", tag: "InterestAndDividendIncomeOperating" },
    { taxonomy: "us-gaap", tag: "RegulatedAndUnregulatedOperatingRevenue" },
    { taxonomy: "ifrs-full", tag: "Revenue" },
  ],
  costOfRevenue: [
    { taxonomy: "us-gaap", tag: "CostOfRevenue" },
    { taxonomy: "us-gaap", tag: "CostOfGoodsAndServicesSold" },
    { taxonomy: "us-gaap", tag: "CostOfGoodsSold" },
    { taxonomy: "ifrs-full", tag: "CostOfSales" },
  ],
  grossProfit: [
    { taxonomy: "us-gaap", tag: "GrossProfit" },
    { taxonomy: "ifrs-full", tag: "GrossProfit" },
  ],
  operatingIncome: [
    { taxonomy: "us-gaap", tag: "OperatingIncomeLoss" },
    { taxonomy: "ifrs-full", tag: "ProfitLossFromOperatingActivities" },
  ],
  netIncome: [
    { taxonomy: "us-gaap", tag: "NetIncomeLoss" },
    { taxonomy: "us-gaap", tag: "ProfitLoss" },
    { taxonomy: "us-gaap", tag: "NetIncomeLossAvailableToCommonStockholdersBasic" },
    { taxonomy: "ifrs-full", tag: "ProfitLoss" },
    { taxonomy: "ifrs-full", tag: "ProfitLossAttributableToOwnersOfParent" },
  ],
  cashAndEquivalents: [
    { taxonomy: "us-gaap", tag: "CashAndCashEquivalentsAtCarryingValue" },
    {
      taxonomy: "us-gaap",
      tag: "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents",
    },
    { taxonomy: "us-gaap", tag: "Cash" },
    {
      taxonomy: "us-gaap",
      tag: "CashAndCashEquivalentsAtCarryingValueIncludingDiscontinuedOperations",
    },
    { taxonomy: "ifrs-full", tag: "CashAndCashEquivalents" },
  ],
  shortTermInvestments: [
    { taxonomy: "us-gaap", tag: "MarketableSecuritiesCurrent" },
    { taxonomy: "us-gaap", tag: "ShortTermInvestments" },
    { taxonomy: "us-gaap", tag: "AvailableForSaleSecuritiesDebtSecuritiesCurrent" },
    { taxonomy: "ifrs-full", tag: "OtherCurrentFinancialAssets" },
  ],
  combinedCashAndShortTerm: [
    { taxonomy: "us-gaap", tag: "CashCashEquivalentsAndShortTermInvestments" },
    { taxonomy: "us-gaap", tag: "CashAndMarketableSecurities" },
  ],
  operatingCashFlow: [
    { taxonomy: "us-gaap", tag: "NetCashProvidedByUsedInOperatingActivities" },
    {
      taxonomy: "us-gaap",
      tag: "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations",
    },
    { taxonomy: "ifrs-full", tag: "CashFlowsFromUsedInOperatingActivities" },
  ],
  capex: [
    { taxonomy: "us-gaap", tag: "PaymentsToAcquirePropertyPlantAndEquipment" },
    { taxonomy: "us-gaap", tag: "PaymentsToAcquireProductiveAssets" },
    { taxonomy: "us-gaap", tag: "CapitalExpendituresIncurredButNotYetPaid" },
    { taxonomy: "us-gaap", tag: "PaymentsForCapitalImprovements" },
    {
      taxonomy: "ifrs-full",
      tag: "PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities",
    },
  ],
  debtCombined: [
    { taxonomy: "us-gaap", tag: "LongTermDebtAndCapitalLeaseObligations" },
    { taxonomy: "us-gaap", tag: "LongTermDebt" },
    { taxonomy: "us-gaap", tag: "DebtAndCapitalLeaseObligations" },
    { taxonomy: "us-gaap", tag: "NotesPayable" },
    { taxonomy: "us-gaap", tag: "ConvertibleNotesPayable" },
    { taxonomy: "ifrs-full", tag: "Borrowings" },
  ],
  debtNoncurrent: [
    { taxonomy: "us-gaap", tag: "LongTermDebtNoncurrent" },
    { taxonomy: "us-gaap", tag: "LongTermDebtAndCapitalLeaseObligationsCurrent" },
    { taxonomy: "ifrs-full", tag: "NoncurrentPortionOfNoncurrentBorrowings" },
  ],
  debtCurrent: [
    { taxonomy: "us-gaap", tag: "LongTermDebtCurrent" },
    { taxonomy: "us-gaap", tag: "ShortTermBorrowings" },
    { taxonomy: "us-gaap", tag: "DebtCurrent" },
    { taxonomy: "ifrs-full", tag: "CurrentBorrowingsAndCurrentPortionOfNoncurrentBorrowings" },
  ],
  sharesOutstanding: [
    { taxonomy: "us-gaap", tag: "CommonStockSharesOutstanding" },
    { taxonomy: "dei", tag: "EntityCommonStockSharesOutstanding" },
    { taxonomy: "us-gaap", tag: "WeightedAverageNumberOfDilutedSharesOutstanding" },
    { taxonomy: "us-gaap", tag: "WeightedAverageNumberOfSharesOutstandingBasic" },
    { taxonomy: "ifrs-full", tag: "NumberOfSharesOutstanding" },
    { taxonomy: "ifrs-full", tag: "WeightedAverageShares" },
  ],
};

function daysBetween(startIso: string, endIso: string): number {
  const s = Date.parse(startIso);
  const e = Date.parse(endIso);
  if (!Number.isFinite(s) || !Number.isFinite(e)) return -1;
  return Math.round((e - s) / 86_400_000);
}

type SpanKind = "quarter" | "ytd6" | "ytd9" | "annual" | "other";

function classifyDuration(start?: string, end?: string): SpanKind {
  if (!start || !end) return "other";
  const days = daysBetween(start, end);
  if (days >= 70 && days <= 110) return "quarter";
  if (days >= 160 && days <= 200) return "ytd6";
  if (days >= 250 && days <= 295) return "ytd9";
  if (days >= 340 && days <= 395) return "annual";
  return "other";
}

function isCurrencyUnit(unit: string): boolean {
  return /^[A-Z]{3}$/.test(unit);
}

export function detectDominantCurrency(facts: SecCompanyFactsJson["facts"]): string {
  const counts = new Map<string, number>();
  for (const tax of ["us-gaap", "ifrs-full"]) {
    const tmap = facts[tax];
    if (!tmap) continue;
    for (const tagName of Object.keys(tmap).slice(0, 120)) {
      const units = tmap[tagName]?.units;
      if (!units) continue;
      for (const u of Object.keys(units)) {
        if (isCurrencyUnit(u)) {
          counts.set(u, (counts.get(u) ?? 0) + (units[u]?.length ?? 0));
        }
      }
    }
  }
  if (counts.size === 0) return "USD";
  // Prefer USD if company reports substantial USD facts (e.g., BABA reports both CNY & USD)
  const usdCount = counts.get("USD") ?? 0;
  let topCurrency = "USD";
  let topCount = 0;
  for (const [curr, cnt] of counts.entries()) {
    if (cnt > topCount) {
      topCurrency = curr;
      topCount = cnt;
    }
  }
  if (usdCount > 0 && usdCount >= topCount * 0.4) {
    return "USD";
  }
  return topCurrency;
}

interface TaggedFact {
  entry: SecFactEntry;
  taxonomy: string;
  tag: string;
  unit: string;
  priority: number;
}

function isBetterFact(candidate: TaggedFact, current: TaggedFact): boolean {
  // Primary rule: latest filed date wins (captures restatements/amendments)
  if (candidate.entry.filed !== current.entry.filed) {
    return candidate.entry.filed > current.entry.filed;
  }
  // Tie-breaker 1: amended filing wins
  const candAmended = candidate.entry.form.endsWith("/A");
  const currAmended = current.entry.form.endsWith("/A");
  if (candAmended !== currAmended) return candAmended;
  // Tie-breaker 2: higher-priority tag wins
  if (candidate.priority !== current.priority) {
    return candidate.priority < current.priority;
  }
  return false;
}

function collectInstantFacts(
  facts: SecCompanyFactsJson["facts"],
  candidates: TagCandidate[],
  currency: string,
  unitType: "currency" | "shares",
): Map<string, FactProvenance> {
  const bestByEnd = new Map<string, TaggedFact>();

  candidates.forEach((cand, priority) => {
    const tagObj = facts[cand.taxonomy]?.[cand.tag];
    if (!tagObj?.units) return;
    const unitKey =
      unitType === "shares"
        ? "shares"
        : tagObj.units[currency]
          ? currency
          : undefined;
    if (!unitKey) return;
    const rows = tagObj.units[unitKey];
    if (!rows) return;

    for (const r of rows) {
      if (!ALLOWED_FORMS.has(r.form)) continue;
      if (!r.end || typeof r.val !== "number" || !Number.isFinite(r.val)) continue;
      const wrapped: TaggedFact = {
        entry: r,
        taxonomy: cand.taxonomy,
        tag: cand.tag,
        unit: unitKey,
        priority,
      };
      const existing = bestByEnd.get(r.end);
      if (!existing || isBetterFact(wrapped, existing)) {
        bestByEnd.set(r.end, wrapped);
      }
    }
  });

  const out = new Map<string, FactProvenance>();
  for (const [end, f] of bestByEnd.entries()) {
    out.set(end, {
      tag: f.tag,
      taxonomy: f.taxonomy,
      accn: f.entry.accn,
      form: f.entry.form,
      filed: f.entry.filed,
      end: f.entry.end,
      val: f.entry.val,
      unit: f.unit,
    });
  }
  return out;
}

interface DurationSeriesResult {
  annual: Map<string, FactProvenance>;
  quarterly: Map<string, FactProvenance>;
  decumulatedEnds: Set<string>;
}

function collectDurationFacts(
  facts: SecCompanyFactsJson["facts"],
  candidates: TagCandidate[],
  currency: string,
): DurationSeriesResult {
  // Deduplicate by exact (start, end) keeping latest filed
  const bestBySpan = new Map<string, TaggedFact>();

  candidates.forEach((cand, priority) => {
    const tagObj = facts[cand.taxonomy]?.[cand.tag];
    const rows = tagObj?.units?.[currency];
    if (!rows) return;

    for (const r of rows) {
      if (!ALLOWED_FORMS.has(r.form)) continue;
      if (!r.start || !r.end || typeof r.val !== "number" || !Number.isFinite(r.val)) {
        continue;
      }
      const spanKey = `${r.start}|${r.end}`;
      const wrapped: TaggedFact = {
        entry: r,
        taxonomy: cand.taxonomy,
        tag: cand.tag,
        unit: currency,
        priority,
      };
      const existing = bestBySpan.get(spanKey);
      if (!existing || isBetterFact(wrapped, existing)) {
        bestBySpan.set(spanKey, wrapped);
      }
    }
  });

  const annual = new Map<string, FactProvenance>();
  const quarterly = new Map<string, FactProvenance>();
  const ytd6ByStart = new Map<string, TaggedFact[]>();
  const ytd9ByStart = new Map<string, TaggedFact[]>();
  const qByStart = new Map<string, TaggedFact[]>();
  const annualByStart = new Map<string, TaggedFact[]>();

  for (const f of bestBySpan.values()) {
    const kind = classifyDuration(f.entry.start, f.entry.end);
    const start = f.entry.start!;
    const prov: FactProvenance = {
      tag: f.tag,
      taxonomy: f.taxonomy,
      accn: f.entry.accn,
      form: f.entry.form,
      filed: f.entry.filed,
      start: f.entry.start,
      end: f.entry.end,
      val: f.entry.val,
      unit: f.unit,
    };

    if (kind === "annual") {
      const existing = annual.get(f.entry.end);
      if (!existing || prov.filed > existing.filed) {
        annual.set(f.entry.end, prov);
      }
      const arr = annualByStart.get(start) ?? [];
      arr.push(f);
      annualByStart.set(start, arr);
    } else if (kind === "quarter") {
      const existing = quarterly.get(f.entry.end);
      if (!existing || prov.filed > existing.filed) {
        quarterly.set(f.entry.end, prov);
      }
      const arr = qByStart.get(start) ?? [];
      arr.push(f);
      qByStart.set(start, arr);
    } else if (kind === "ytd6") {
      const arr = ytd6ByStart.get(start) ?? [];
      arr.push(f);
      ytd6ByStart.set(start, arr);
    } else if (kind === "ytd9") {
      const arr = ytd9ByStart.get(start) ?? [];
      arr.push(f);
      ytd9ByStart.set(start, arr);
    }
  }

  const decumulatedEnds = new Set<string>();

  // De-cumulate YTD6 - Q1 -> Q2
  for (const [start, ytd6List] of ytd6ByStart.entries()) {
    const q1 = qByStart.get(start)?.[0];
    if (!q1) continue;
    for (const y6 of ytd6List) {
      if (quarterly.has(y6.entry.end)) continue;
      if (daysBetween(q1.entry.end, y6.entry.end) >= 70) {
        quarterly.set(y6.entry.end, {
          tag: y6.tag,
          taxonomy: y6.taxonomy,
          accn: y6.entry.accn,
          form: y6.entry.form,
          filed: y6.entry.filed,
          start: q1.entry.end,
          end: y6.entry.end,
          val: y6.entry.val - q1.entry.val,
          unit: y6.unit,
          decumulatedFrom: [y6.entry.accn, q1.entry.accn],
        });
        decumulatedEnds.add(y6.entry.end);
      }
    }
  }

  // De-cumulate YTD9 - YTD6 -> Q3
  for (const [start, ytd9List] of ytd9ByStart.entries()) {
    const ytd6 = ytd6ByStart.get(start)?.[0];
    if (!ytd6) continue;
    for (const y9 of ytd9List) {
      if (quarterly.has(y9.entry.end)) continue;
      if (daysBetween(ytd6.entry.end, y9.entry.end) >= 70) {
        quarterly.set(y9.entry.end, {
          tag: y9.tag,
          taxonomy: y9.taxonomy,
          accn: y9.entry.accn,
          form: y9.entry.form,
          filed: y9.entry.filed,
          start: ytd6.entry.end,
          end: y9.entry.end,
          val: y9.entry.val - ytd6.entry.val,
          unit: y9.unit,
          decumulatedFrom: [y9.entry.accn, ytd6.entry.accn],
        });
        decumulatedEnds.add(y9.entry.end);
      }
    }
  }

  // De-cumulate FY - YTD9 -> Q4
  for (const [start, fyList] of annualByStart.entries()) {
    const ytd9 = ytd9ByStart.get(start)?.[0];
    if (!ytd9) continue;
    for (const fy of fyList) {
      if (quarterly.has(fy.entry.end)) continue;
      if (daysBetween(ytd9.entry.end, fy.entry.end) >= 70) {
        quarterly.set(fy.entry.end, {
          tag: fy.tag,
          taxonomy: fy.taxonomy,
          accn: fy.entry.accn,
          form: fy.entry.form,
          filed: fy.entry.filed,
          start: ytd9.entry.end,
          end: fy.entry.end,
          val: fy.entry.val - ytd9.entry.val,
          unit: fy.unit,
          decumulatedFrom: [fy.entry.accn, ytd9.entry.accn],
        });
        decumulatedEnds.add(fy.entry.end);
      }
    }
  }

  return { annual, quarterly, decumulatedEnds };
}

function findClosestInstant(
  map: Map<string, FactProvenance>,
  targetEnd: string,
  maxDriftDays = 7,
): FactProvenance | undefined {
  const exact = map.get(targetEnd);
  if (exact) return exact;
  let best: FactProvenance | undefined;
  let bestAbs = Infinity;
  for (const [end, prov] of map.entries()) {
    const diff = Math.abs(daysBetween(end, targetEnd));
    if (diff <= maxDriftDays && diff < bestAbs) {
      best = prov;
      bestAbs = diff;
    }
  }
  return best;
}

export function normalizeCompanyFacts(
  companyFacts: SecCompanyFactsJson,
  options: { maxAnnual?: number; maxQuarterly?: number } = {},
): NormalizationResult {
  const facts = companyFacts.facts ?? {};
  const taxonomies = Object.keys(facts);
  const currency = detectDominantCurrency(facts);

  const revenue = collectDurationFacts(facts, TAG_LISTS.revenue, currency);
  const costOfRevenue = collectDurationFacts(facts, TAG_LISTS.costOfRevenue, currency);
  const grossProfit = collectDurationFacts(facts, TAG_LISTS.grossProfit, currency);
  const operatingIncome = collectDurationFacts(facts, TAG_LISTS.operatingIncome, currency);
  const netIncome = collectDurationFacts(facts, TAG_LISTS.netIncome, currency);
  const ocf = collectDurationFacts(facts, TAG_LISTS.operatingCashFlow, currency);
  const capex = collectDurationFacts(facts, TAG_LISTS.capex, currency);

  const cash = collectInstantFacts(facts, TAG_LISTS.cashAndEquivalents, currency, "currency");
  const stInv = collectInstantFacts(facts, TAG_LISTS.shortTermInvestments, currency, "currency");
  const combinedCash = collectInstantFacts(
    facts,
    TAG_LISTS.combinedCashAndShortTerm,
    currency,
    "currency",
  );
  const debtCombined = collectInstantFacts(facts, TAG_LISTS.debtCombined, currency, "currency");
  const debtNoncurrent = collectInstantFacts(facts, TAG_LISTS.debtNoncurrent, currency, "currency");
  const debtCurrent = collectInstantFacts(facts, TAG_LISTS.debtCurrent, currency, "currency");
  const shares = collectInstantFacts(facts, TAG_LISTS.sharesOutstanding, currency, "shares");

  const buildPeriods = (
    periodType: PeriodType,
    limit: number,
  ): NormalizedPeriod[] => {
    const endDates = new Set<string>();
    const addKeys = (m: Map<string, FactProvenance>) => {
      for (const k of m.keys()) endDates.add(k);
    };

    if (periodType === "annual") {
      addKeys(revenue.annual);
      addKeys(netIncome.annual);
      addKeys(ocf.annual);
    } else {
      addKeys(revenue.quarterly);
      addKeys(netIncome.quarterly);
      addKeys(ocf.quarterly);
      // Include balance-sheet dates if company has cash/shares on 10-Q/10-K
      if (endDates.size === 0) {
        addKeys(cash);
      }
    }

    const sortedEnds = Array.from(endDates).sort((a, b) => (a < b ? 1 : -1)).slice(0, limit);
    const periods: NormalizedPeriod[] = [];

    for (const end of sortedEnds) {
      const prov: PeriodProvenanceMap = {};
      const revP = (periodType === "annual" ? revenue.annual : revenue.quarterly).get(end);
      const costP = (periodType === "annual" ? costOfRevenue.annual : costOfRevenue.quarterly).get(end);
      const gpDirectP = (periodType === "annual" ? grossProfit.annual : grossProfit.quarterly).get(end);
      const opP = (periodType === "annual" ? operatingIncome.annual : operatingIncome.quarterly).get(end);
      const niP = (periodType === "annual" ? netIncome.annual : netIncome.quarterly).get(end);
      const ocfP = (periodType === "annual" ? ocf.annual : ocf.quarterly).get(end);
      const capexP = (periodType === "annual" ? capex.annual : capex.quarterly).get(end);

      const cashP = findClosestInstant(cash, end);
      const stInvP = findClosestInstant(stInv, end);
      const combCashP = findClosestInstant(combinedCash, end);
      const debtCombP = findClosestInstant(debtCombined, end);
      const debtNcP = findClosestInstant(debtNoncurrent, end);
      const debtCurrP = findClosestInstant(debtCurrent, end);
      const sharesP = findClosestInstant(shares, end, 45);

      if (revP) prov.revenue = revP;
      if (gpDirectP) prov.grossProfit = gpDirectP;
      else if (revP && costP) prov.grossProfit = revP;
      if (opP) prov.operatingIncome = opP;
      if (niP) prov.netIncome = niP;
      if (cashP) prov.cashAndEquivalents = cashP;
      if (stInvP) prov.shortTermInvestments = stInvP;
      if (ocfP) prov.operatingCashFlow = ocfP;
      if (capexP) prov.capex = capexP;
      if (sharesP) prov.sharesOutstanding = sharesP;

      const grossVal =
        gpDirectP?.val ?? (revP && costP ? revP.val - costP.val : null);

      let liquidityVal: number | null = null;
      if (cashP && stInvP) {
        liquidityVal = cashP.val + stInvP.val;
        prov.totalLiquidity = cashP;
      } else if (combCashP) {
        liquidityVal = combCashP.val;
        prov.totalLiquidity = combCashP;
      } else if (cashP) {
        liquidityVal = cashP.val;
        prov.totalLiquidity = cashP;
      }

      const capexAbs = capexP ? Math.abs(capexP.val) : null;
      const fcfVal = ocfP ? ocfP.val - (capexAbs ?? 0) : null;
      if (ocfP && fcfVal !== null) prov.freeCashFlow = ocfP;

      let debtVal: number | null = null;
      if (debtNcP && debtCurrP) {
        debtVal = debtNcP.val + debtCurrP.val;
        prov.totalDebt = debtNcP;
      } else if (debtCombP) {
        debtVal = debtCombP.val;
        prov.totalDebt = debtCombP;
      } else if (debtNcP) {
        debtVal = debtNcP.val;
        prov.totalDebt = debtNcP;
      } else if (debtCurrP) {
        debtVal = debtCurrP.val;
        prov.totalDebt = debtCurrP;
      }

      const yearNum = Number.parseInt(end.slice(0, 4), 10);
      const isDecumulated =
        periodType === "quarterly" &&
        (ocf.decumulatedEnds.has(end) ||
          revenue.decumulatedEnds.has(end) ||
          netIncome.decumulatedEnds.has(end));

      periods.push({
        periodType,
        periodEnd: end,
        fiscalYear: Number.isFinite(yearNum) ? yearNum : null,
        fiscalPeriod: periodType === "annual" ? "FY" : null,
        currency,
        revenue: revP?.val ?? null,
        grossProfit: grossVal,
        operatingIncome: opP?.val ?? null,
        netIncome: niP?.val ?? null,
        cashAndEquivalents: cashP?.val ?? null,
        shortTermInvestments: stInvP?.val ?? null,
        totalLiquidity: liquidityVal,
        operatingCashFlow: ocfP?.val ?? null,
        capex: capexAbs,
        freeCashFlow: fcfVal,
        totalDebt: debtVal,
        sharesOutstanding: sharesP?.val ?? null,
        isDecumulated,
        provenanceJson: prov,
      });
    }

    return periods;
  };

  return {
    currency,
    taxonomies,
    annual: buildPeriods("annual", options.maxAnnual ?? 8),
    quarterly: buildPeriods("quarterly", options.maxQuarterly ?? 16),
  };
}
