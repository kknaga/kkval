import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { NormalizedPeriod } from "@/lib/sec/xbrl-normalizer";
import { classifyEntity, computeHealthSnapshot } from "./compute";

function makePeriod(
  periodType: "annual" | "quarterly",
  periodEnd: string,
  overrides: Partial<NormalizedPeriod> = {},
): NormalizedPeriod {
  return {
    periodType,
    periodEnd,
    fiscalYear: Number(periodEnd.slice(0, 4)),
    fiscalPeriod: periodType === "annual" ? "FY" : null,
    currency: "USD",
    revenue: 10_000_000,
    grossProfit: 5_000_000,
    operatingIncome: -5_000_000,
    netIncome: -5_000_000,
    cashAndEquivalents: 30_000_000,
    shortTermInvestments: null,
    totalLiquidity: 30_000_000,
    operatingCashFlow: -15_000_000,
    capex: 1_000_000,
    freeCashFlow: -16_000_000,
    totalDebt: 5_000_000,
    sharesOutstanding: 100_000_000,
    isDecumulated: false,
    provenanceJson: {},
    ...overrides,
  };
}

describe("computeHealthSnapshot", () => {
  it("computes critical cash runway and heavy dilution accurately", () => {
    const annual = [
      makePeriod("annual", "2025-12-31", {
        totalLiquidity: 20_000_000,
        operatingCashFlow: -60_000_000,
        sharesOutstanding: 140_000_000,
      }),
      makePeriod("annual", "2024-12-31", {
        totalLiquidity: 45_000_000,
        operatingCashFlow: -45_000_000,
        sharesOutstanding: 100_000_000,
      }),
    ];

    const res = computeHealthSnapshot({
      cik: "0001838359",
      ticker: "TEST",
      name: "Test SmallCap Inc",
      sic: "7371",
      taxonomies: ["us-gaap"],
      forms: ["10-K", "10-Q"],
      currency: "USD",
      fxRatePerUsd: 1,
      annual,
      quarterly: [],
      offeringFilings12m: 2,
      insiderBuyCount90d: 0,
      insiderSellCount90d: 2,
      insiderNetBuy90dUsd: -50_000,
      topInstitutionalCount: 12,
    });

    assert.equal(res.entityClass, "operating");
    assert.equal(res.isIndexable, true);
    assert.equal(res.verdict, "critical");
    assert.equal(Math.round(res.cashRunwayMonths!), 4); // 20M / (60M/12) = 4.0 mo
    assert.equal(Math.round(res.shareDilution1yPct!), 40);
    assert.ok(res.warningsJson.some((w) => w.code === "runway_critical"));
    assert.ok(res.warningsJson.some((w) => w.code === "heavy_dilution"));
    assert.ok(res.warningsJson.some((w) => w.code === "offering_filings_active"));
  });

  it("flags reverse splits instead of calling them share buybacks", () => {
    const quarterly = [
      makePeriod("quarterly", "2026-09-30", { sharesOutstanding: 10_000_000 }),
      makePeriod("quarterly", "2026-06-30", { sharesOutstanding: 100_000_000 }),
      makePeriod("quarterly", "2026-03-31", { sharesOutstanding: 100_000_000 }),
      makePeriod("quarterly", "2025-12-31", { sharesOutstanding: 90_000_000 }),
    ];

    const res = computeHealthSnapshot({
      cik: "0000000001",
      ticker: "RSPL",
      name: "Reverse Split Corp",
      sic: "2834",
      taxonomies: ["us-gaap"],
      forms: ["10-Q"],
      currency: "USD",
      fxRatePerUsd: 1,
      annual: [],
      quarterly,
      offeringFilings12m: 1,
      insiderBuyCount90d: 0,
      insiderSellCount90d: 0,
      insiderNetBuy90dUsd: null,
      topInstitutionalCount: 0,
    });

    assert.equal(res.entityClass, "biotech");
    assert.equal(res.possibleReverseSplit, true);
    assert.ok(res.warningsJson.some((w) => w.code === "possible_reverse_split"));
  });

  it("excludes SPACs from indexing and marks financial banks appropriately", () => {
    assert.equal(classifyEntity("6770", ["us-gaap"], ["10-K"]), "spac");
    assert.equal(classifyEntity("6022", ["us-gaap"], ["10-K"]), "financial");
    assert.equal(classifyEntity("2834", ["ifrs-full"], ["20-F"]), "biotech");
    assert.equal(classifyEntity("7371", ["ifrs-full"], ["20-F"]), "foreign");

    const spacRes = computeHealthSnapshot({
      cik: "0000000002",
      ticker: "SPAC",
      name: "Blank Check Corp",
      sic: "6770",
      taxonomies: ["spac", "us-gaap"],
      forms: ["10-K"],
      currency: "USD",
      fxRatePerUsd: 1,
      annual: [makePeriod("annual", "2025-12-31"), makePeriod("annual", "2024-12-31")],
      quarterly: [],
      offeringFilings12m: 0,
      insiderBuyCount90d: 0,
      insiderSellCount90d: 0,
      insiderNetBuy90dUsd: null,
      topInstitutionalCount: 0,
    });

    assert.equal(spacRes.isIndexable, false);
    assert.equal(spacRes.verdict, "excluded");
    assert.equal(spacRes.cashRunwayMonths, null);
  });
});
