import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { HealthSummaryData } from "@/db/schema";
import {
  localizePath,
  normalizeLocaleSlug,
  stripLocalePrefix,
  SUPPORTED_LOCALES,
} from "./locales";
import { getMessages, renderHealthSummary } from "./messages";
import { canonicalizeComparePair, parseCompareSlug, serializeJsonLd } from "../seo";

describe("i18n and SEO routing helpers", () => {
  it("keeps English unprefixed and supports all 7 language paths without ticker collisions", () => {
    assert.equal(SUPPORTED_LOCALES.length, 7);
    assert.equal(localizePath("/stock/KO", "en"), "/stock/KO");
    assert.equal(localizePath("/stock/KO", "ko"), "/ko/stock/KO");
    assert.equal(localizePath("/ko/stock/KO", "de"), "/de/stock/KO");
    assert.equal(localizePath("/zh-tw/screen/small-caps-under-12-months-cash", "en"), "/screen/small-caps-under-12-months-cash");

    assert.deepEqual(stripLocalePrefix("/es/stock/AAPL"), {
      locale: "es",
      pathnameWithoutLocale: "/stock/AAPL",
    });
    assert.equal(normalizeLocaleSlug("ZH_TW"), "zh-tw");
    assert.equal(normalizeLocaleSlug("AAPL"), null);
  });

  it("canonicalizes compare pairs alphabetically and escapes JSON-LD", () => {
    assert.deepEqual(canonicalizeComparePair("msft", "aapl"), {
      a: "AAPL",
      b: "MSFT",
      slug: "AAPL-vs-MSFT",
    });
    assert.deepEqual(parseCompareSlug("NVDA-vs-AMD"), {
      rawA: "NVDA",
      rawB: "AMD",
    });
    assert.equal(parseCompareSlug("AAPL-vs-AAPL"), null);
    assert.equal(serializeJsonLd({ a: "<script>" }), '{"a":"\\u003cscript>"}');
  });

  it("renders deterministic localized summaries across all 7 languages", () => {
    const sample: HealthSummaryData = {
      ticker: "RGTI",
      name: "Rigetti Computing, Inc.",
      entityClass: "operating",
      currency: "USD",
      latestPeriodEnd: "2026-09-30",
      totalLiquidityUsd: 90_000_000,
      totalLiquidityNative: 90_000_000,
      isCashFlowPositive: false,
      cashRunwayMonths: 14.5,
      quarterlyBurnUsd: 18_600_000,
      shareDilution1yPct: 28.4,
      possibleReverseSplit: false,
      debtToCashRatio: 0.25,
      fcfTtmUsd: -75_000_000,
      offeringFilings12m: 2,
      insiderBuyCount90d: 1,
      insiderSellCount90d: 0,
      insiderNetBuy90dUsd: 50_000,
    };

    for (const loc of SUPPORTED_LOCALES) {
      const msg = getMessages(loc.slug);
      assert.ok(msg.nav.screeners.length > 0);
      const summary = renderHealthSummary(sample, loc.slug);
      assert.ok(summary.includes("RGTI"));
      assert.ok(summary.includes("14.5"));
    }
  });
});
