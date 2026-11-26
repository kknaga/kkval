import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { stripXsltPrefix } from "./client";
import { parseDailyFormIndexForForm4, parseForm4Xml } from "./form4";

describe("Form 4 parser", () => {
  it("strips XSLT prefix from primaryDocument", () => {
    assert.equal(stripXsltPrefix("xslF345X06/form4.xml"), "form4.xml");
    assert.equal(stripXsltPrefix("doc.xml"), "doc.xml");
  });

  it("parses open-market purchases and option grants distinctly", () => {
    const xml = `<?xml version="1.0"?>
<ownershipDocument>
  <issuer><issuerCik>0001838359</issuerCik></issuer>
  <reportingOwner>
    <reportingOwnerId><rptOwnerName>Jane Doe</rptOwnerName></reportingOwnerId>
    <reportingOwnerRelationship>
      <isDirector>1</isDirector>
      <isOfficer>1</isOfficer>
      <isTenPercentOwner>0</isTenPercentOwner>
      <officerTitle>Chief Executive Officer</officerTitle>
    </reportingOwnerRelationship>
  </reportingOwner>
  <nonDerivativeTable>
    <nonDerivativeTransaction>
      <transactionDate><value>2026-11-20</value></transactionDate>
      <transactionCoding><transactionCode>P</transactionCode></transactionCoding>
      <transactionAmounts>
        <transactionShares><value>15000</value></transactionShares>
        <transactionPricePerShare><value>2.50</value></transactionPricePerShare>
        <transactionAcquiredDisposedCode><value>A</value></transactionAcquiredDisposedCode>
      </transactionAmounts>
      <postTransactionAmounts>
        <sharesOwnedFollowingTransaction><value>115000</value></sharesOwnedFollowingTransaction>
      </postTransactionAmounts>
    </nonDerivativeTransaction>
    <nonDerivativeTransaction>
      <transactionDate><value>2026-11-21</value></transactionDate>
      <transactionCoding><transactionCode>M</transactionCode></transactionCoding>
      <transactionAmounts>
        <transactionShares><value>5000</value></transactionShares>
        <transactionPricePerShare><value>0</value></transactionPricePerShare>
        <transactionAcquiredDisposedCode><value>A</value></transactionAcquiredDisposedCode>
      </transactionAmounts>
    </nonDerivativeTransaction>
  </nonDerivativeTable>
</ownershipDocument>`;

    const txs = parseForm4Xml(xml, {
      cik: "0001838359",
      accn: "0001140361-26-045775",
      filingDate: "2026-11-22",
      primaryDocument: "xslF345X06/form4.xml",
    });

    assert.equal(txs.length, 2);
    assert.equal(txs[0].ownerName, "Jane Doe");
    assert.equal(txs[0].ownerTitle, "Chief Executive Officer");
    assert.equal(txs[0].isOpenMarket, true);
    assert.equal(txs[0].totalValueUsd, 37500);
    assert.equal(txs[1].transactionCode, "M");
    assert.equal(txs[1].isOpenMarket, false);
  });

  it("parses daily form.YYYYMMDD.idx Form 4 lines", () => {
    const idx = `Form Type   Company Name                                          CIK         Date Filed  File Name
---------------------------------------------------------------------------------------------------------------------------------------------
4           Apple Inc.                                            320193      20261125    edgar/data/320193/0001140361-26-045775.txt
10-K        Some Co                                               12345       20261125    edgar/data/12345/0001104659-26-000001.txt
4           Rigetti Computing, Inc.                               1838359     20261125    edgar/data/1838359/0001104659-26-011111.txt`;

    const rows = parseDailyFormIndexForForm4(idx);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].cik, "0000320193");
    assert.equal(rows[0].accn, "0001140361-26-045775");
    assert.equal(rows[0].dateFiled, "2026-11-25");
    assert.equal(rows[1].cik, "0001838359");
  });
});
