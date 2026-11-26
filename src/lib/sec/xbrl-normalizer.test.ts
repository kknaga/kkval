import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SecCompanyFactsJson } from "./client";
import { normalizeCompanyFacts } from "./xbrl-normalizer";

describe("normalizeCompanyFacts", () => {
  it("deduplicates comparative spans by latest filed date and de-cumulates YTD cash flows", () => {
    const fixture: SecCompanyFactsJson = {
      cik: 1838359,
      facts: {
        "us-gaap": {
          RevenueFromContractWithCustomerExcludingAssessedTax: {
            units: {
              USD: [
                {
                  start: "2025-01-01",
                  end: "2025-03-31",
                  val: 2_000_000,
                  accn: "0001-25-001",
                  form: "10-Q",
                  filed: "2025-05-10",
                },
                {
                  start: "2025-04-01",
                  end: "2025-06-30",
                  val: 2_500_000,
                  accn: "0001-25-002",
                  form: "10-Q",
                  filed: "2025-08-10",
                },
                {
                  start: "2025-07-01",
                  end: "2025-09-30",
                  val: 3_000_000,
                  accn: "0001-25-003",
                  form: "10-Q",
                  filed: "2025-11-10",
                },
                {
                  start: "2025-01-01",
                  end: "2025-12-31",
                  val: 11_500_000,
                  accn: "0001-26-004",
                  form: "10-K",
                  filed: "2026-03-01",
                },
              ],
            },
          },
          NetCashProvidedByUsedInOperatingActivities: {
            units: {
              USD: [
                // Q1 3M
                {
                  start: "2025-01-01",
                  end: "2025-03-31",
                  val: -10_000_000,
                  accn: "0001-25-001",
                  form: "10-Q",
                  filed: "2025-05-10",
                },
                // Duplicate comparative Q1 reported later (restated) -> should win!
                {
                  start: "2025-01-01",
                  end: "2025-03-31",
                  val: -11_000_000,
                  accn: "0001-26-001",
                  form: "10-Q",
                  filed: "2026-05-10",
                },
                // Q2 YTD 6M
                {
                  start: "2025-01-01",
                  end: "2025-06-30",
                  val: -25_000_000,
                  accn: "0001-25-002",
                  form: "10-Q",
                  filed: "2025-08-10",
                },
                // Q3 YTD 9M
                {
                  start: "2025-01-01",
                  end: "2025-09-30",
                  val: -40_000_000,
                  accn: "0001-25-003",
                  form: "10-Q",
                  filed: "2025-11-10",
                },
                // FY 12M
                {
                  start: "2025-01-01",
                  end: "2025-12-31",
                  val: -60_000_000,
                  accn: "0001-26-004",
                  form: "10-K",
                  filed: "2026-03-01",
                },
              ],
            },
          },
          PaymentsToAcquirePropertyPlantAndEquipment: {
            units: {
              USD: [
                {
                  start: "2025-01-01",
                  end: "2025-12-31",
                  val: 4_000_000,
                  accn: "0001-26-004",
                  form: "10-K",
                  filed: "2026-03-01",
                },
              ],
            },
          },
          CashAndCashEquivalentsAtCarryingValue: {
            units: {
              USD: [
                {
                  end: "2025-12-31",
                  val: 30_000_000,
                  accn: "0001-26-004",
                  form: "10-K",
                  filed: "2026-03-01",
                },
              ],
            },
          },
          MarketableSecuritiesCurrent: {
            units: {
              USD: [
                {
                  end: "2025-12-31",
                  val: 50_000_000,
                  accn: "0001-26-004",
                  form: "10-K",
                  filed: "2026-03-01",
                },
              ],
            },
          },
        },
      },
    };

    const res = normalizeCompanyFacts(fixture);
    assert.equal(res.currency, "USD");
    assert.equal(res.annual.length, 1);
    const fy = res.annual[0];
    assert.equal(fy.periodEnd, "2025-12-31");
    assert.equal(fy.operatingCashFlow, -60_000_000);
    assert.equal(fy.capex, 4_000_000);
    assert.equal(fy.freeCashFlow, -64_000_000);
    assert.equal(fy.totalLiquidity, 80_000_000);

    const qByEnd = new Map(res.quarterly.map((q) => [q.periodEnd, q]));
    assert.equal(qByEnd.get("2025-03-31")?.operatingCashFlow, -11_000_000);
    assert.equal(qByEnd.get("2025-06-30")?.operatingCashFlow, -14_000_000); // -25M - (-11M)
    assert.equal(qByEnd.get("2025-09-30")?.operatingCashFlow, -15_000_000); // -40M - (-25M)
    assert.equal(qByEnd.get("2025-12-31")?.operatingCashFlow, -20_000_000); // -60M - (-40M)
    assert.equal(qByEnd.get("2025-12-31")?.isDecumulated, true);
  });

  it("preserves non-USD reporting currency for IFRS foreign issuers", () => {
    const ifrsFixture: SecCompanyFactsJson = {
      cik: 353278,
      facts: {
        "ifrs-full": {
          Revenue: {
            units: {
              DKK: [
                {
                  start: "2025-01-01",
                  end: "2025-12-31",
                  val: 290_000_000_000,
                  accn: "0002-26-001",
                  form: "20-F",
                  filed: "2026-02-05",
                },
              ],
            },
          },
          CashAndCashEquivalents: {
            units: {
              DKK: [
                {
                  end: "2025-12-31",
                  val: 40_000_000_000,
                  accn: "0002-26-001",
                  form: "20-F",
                  filed: "2026-02-05",
                },
              ],
            },
          },
        },
      },
    };

    const res = normalizeCompanyFacts(ifrsFixture);
    assert.equal(res.currency, "DKK");
    assert.equal(res.annual[0]?.revenue, 290_000_000_000);
    assert.equal(res.annual[0]?.totalLiquidity, 40_000_000_000);
  });
});
