import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cleanCompanyName, formatTradeImpact } from "./format-stake-pct";

describe("kkval company name cleaner and stake trade impact", () => {
  it("cleans ALL-CAPS SEC company names and strips state suffixes", () => {
    assert.equal(cleanCompanyName("APPLE INC."), "Apple Inc.");
    assert.equal(cleanCompanyName("NVIDIA CORP /DE/"), "Nvidia Corp");
    assert.equal(cleanCompanyName("IBM CORP"), "IBM Corp");
    assert.equal(
      cleanCompanyName("BANK OF AMERICA CORP /DE/"),
      "Bank of America Corp",
    );
    assert.equal(cleanCompanyName("Microsoft Corp"), "Microsoft Corp");
    assert.equal(cleanCompanyName(null), "");
  });

  it("formats insider buy/sell stake percentage accurately", () => {
    assert.equal(
      formatTradeImpact({ action: "S", shares: 800, sharesAfter: 200 }),
      "-80%",
    );
    assert.equal(
      formatTradeImpact({ action: "S", shares: 500, sharesAfter: 0 }),
      "-100%",
    );
    assert.equal(
      formatTradeImpact({ action: "P", shares: 250, sharesAfter: 1250 }),
      "+25%",
    );
    assert.equal(
      formatTradeImpact({ action: "P", shares: 500, sharesAfter: 500 }),
      "New",
    );
  });
});
