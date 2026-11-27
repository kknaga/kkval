const PRESERVED_ACRONYMS = new Set([
  "IBM",
  "AMD",
  "AT&T",
  "USA",
  "US",
  "UK",
  "LLC",
  "LP",
  "LLP",
  "NV",
  "PLC",
  "SA",
  "AI",
  "EV",
  "HP",
  "GE",
  "GM",
  "3M",
  "SAP",
  "TSMC",
  "ETF",
  "REIT",
]);

const SMALL_CONNECTORS = new Set(["of", "and", "the", "&"]);

/**
 * Clean SEC company names (strip trailing /DE/-style state suffixes and format
 * ALL-CAPS names into readable title case while preserving known acronyms).
 */
export function cleanCompanyName(raw: string | null | undefined): string {
  if (!raw) return "";
  const cleaned = raw
    .replace(/\s*\/[A-Z]{2,3}\/?$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "";

  const hasLowercase = /[a-z]/.test(cleaned);
  if (hasLowercase) return cleaned;

  const words = cleaned.split(" ");
  return words
    .map((word, idx) => {
      const m = /^([^A-Za-z0-9]*)([A-Za-z0-9&.]+)([^A-Za-z0-9]*)$/.exec(word);
      if (!m) return word;
      const [, prefix, core, suffix] = m;
      const upper = core.toUpperCase();
      if (PRESERVED_ACRONYMS.has(upper)) {
        return `${prefix}${upper}${suffix}`;
      }
      const lower = core.toLowerCase();
      if (idx > 0 && SMALL_CONNECTORS.has(lower)) {
        return `${prefix}${lower}${suffix}`;
      }
      const titled = lower.charAt(0).toUpperCase() + lower.slice(1);
      return `${prefix}${titled}${suffix}`;
    })
    .join(" ");
}

/**
 * Compute % of prior stake sold: sold / (remaining + sold) * 100 in (0, 100].
 */
export function calcSellPctOfStake(
  soldAmount: number,
  remainingAmount: number,
): number | null {
  if (!(soldAmount > 0) || remainingAmount < 0 || !Number.isFinite(remainingAmount)) {
    return null;
  }
  const prior = remainingAmount + soldAmount;
  if (!(prior > 0)) return null;
  return Math.min(100, (soldAmount / prior) * 100);
}

/**
 * Compute % increase to prior stake from buying: bought / (remaining - bought) * 100.
 * If remaining <= bought (entire current stake built via buys), returns { kind: "new" }.
 */
export function calcBuyPctOfStake(
  boughtAmount: number,
  remainingAmount: number,
): { kind: "pct"; value: number } | { kind: "new" } | null {
  if (!(boughtAmount > 0) || !(remainingAmount > 0) || !Number.isFinite(remainingAmount)) {
    return null;
  }
  if (remainingAmount <= boughtAmount) {
    return { kind: "new" };
  }
  const prior = remainingAmount - boughtAmount;
  if (!(prior > 0)) return { kind: "new" };
  return { kind: "pct", value: (boughtAmount / prior) * 100 };
}

export function formatPctBadge(pct: number, sign: "+" | "-"): string {
  if (pct < 0.1) return `${sign}<0.1%`;
  if (pct > 999) return `${sign}>999%`;
  if (pct < 10) return `${sign}${Number(pct.toFixed(1))}%`;
  return `${sign}${Math.round(pct)}%`;
}

export function formatAggregateSellImpact(
  soldUsd: number,
  remainingStakeUsd: number,
): string | null {
  const pct = calcSellPctOfStake(soldUsd, remainingStakeUsd);
  if (pct === null) return null;
  return formatPctBadge(pct, "-");
}

export function formatAggregateBuyImpact(
  boughtUsd: number,
  remainingStakeUsd: number,
): string | null {
  const res = calcBuyPctOfStake(boughtUsd, remainingStakeUsd);
  if (!res) return null;
  if (res.kind === "new") return "New";
  return formatPctBadge(res.value, "+");
}

export function formatTradeImpact(params: {
  action: "P" | "S";
  shares: number;
  sharesAfter: number | null;
  totalValueUsd?: number | null;
  fallbackRemainingUsd?: number | null;
}): string | null {
  const hasShareCounts =
    params.shares > 0 &&
    params.sharesAfter !== null &&
    Number.isFinite(params.sharesAfter) &&
    params.sharesAfter >= 0;

  if (hasShareCounts) {
    if (params.action === "S") {
      const pct = calcSellPctOfStake(params.shares, params.sharesAfter!);
      return pct === null ? null : formatPctBadge(pct, "-");
    }
    const res = calcBuyPctOfStake(params.shares, params.sharesAfter!);
    if (!res) return null;
    return res.kind === "new" ? "New" : formatPctBadge(res.value, "+");
  }

  if (
    params.totalValueUsd &&
    params.totalValueUsd > 0 &&
    params.fallbackRemainingUsd !== null &&
    params.fallbackRemainingUsd !== undefined &&
    params.fallbackRemainingUsd >= 0
  ) {
    return params.action === "S"
      ? formatAggregateSellImpact(params.totalValueUsd, params.fallbackRemainingUsd)
      : formatAggregateBuyImpact(params.totalValueUsd, params.fallbackRemainingUsd);
  }

  return null;
}
