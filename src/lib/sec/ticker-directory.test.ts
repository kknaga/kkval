import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isValidTickerShape, rankTickerMatches } from "./ticker-directory";

describe("SEC ticker directory helpers", () => {
  it("validates ticker shape to reject garbage bot paths", () => {
    assert.equal(isValidTickerShape("AAPL"), true);
    assert.equal(isValidTickerShape("brk-b"), true);
    assert.equal(isValidTickerShape("invalid/path"), false);
    assert.equal(isValidTickerShape("VERYLONGTICKER123"), false);
  });

  it("ranks exact ticker match before prefix and company name matches without duplicates", () => {
    const sample = [
      { ticker: "APLE", name: "Apple Hospitality REIT", exchange: "NYSE" },
      { ticker: "AAPL", name: "Apple Inc.", exchange: "Nasdaq" },
      { ticker: "AAP", name: "Advance Auto Parts", exchange: "NYSE" },
      { ticker: "AAPL", name: "Apple Inc.", exchange: "Nasdaq" },
    ];

    const hits = rankTickerMatches(sample, "aap", 10);
    assert.deepEqual(
      hits.map((h) => h.ticker),
      ["AAP", "AAPL"],
    );

    const byName = rankTickerMatches(sample, "hospitality", 10);
    assert.deepEqual(
      byName.map((h) => h.ticker),
      ["APLE"],
    );
  });
});
