import { XMLParser } from "fast-xml-parser";
import { padCik } from "./client";

export interface ParsedForm4Transaction {
  accn: string;
  cik: string;
  filingDate: string;
  transactionDate: string;
  ownerName: string;
  ownerTitle: string | null;
  isDirector: boolean;
  isOfficer: boolean;
  isTenPercentOwner: boolean;
  transactionCode: string;
  acquiredDisposed: string | null;
  shares: number;
  pricePerShare: number;
  totalValueUsd: number | null;
  sharesAfter: number | null;
  isOpenMarket: boolean;
  primaryDocument: string | null;
}

export interface DailyIndexForm4Row {
  form: string;
  companyName: string;
  cik: string;
  dateFiled: string;
  fileName: string;
  accn: string;
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  trimValues: true,
  parseTagValue: false,
});

function asArray<T>(val: T | T[] | undefined | null): T[] {
  if (val === undefined || val === null) return [];
  return Array.isArray(val) ? val : [val];
}

function unwrapValue(node: unknown): string | null {
  if (node === null || node === undefined) return null;
  if (typeof node === "string" || typeof node === "number" || typeof node === "boolean") {
    return String(node).trim();
  }
  if (typeof node === "object" && "value" in (node as Record<string, unknown>)) {
    const inner = (node as Record<string, unknown>).value;
    return inner !== undefined && inner !== null ? String(inner).trim() : null;
  }
  return null;
}

function toNum(val: unknown): number | null {
  const s = unwrapValue(val);
  if (!s) return null;
  const n = Number.parseFloat(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function toBool(val: unknown): boolean {
  const s = unwrapValue(val)?.toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}

export function parseForm4Xml(
  xmlText: string,
  meta: {
    cik: string;
    accn: string;
    filingDate: string;
    primaryDocument?: string | null;
  },
): ParsedForm4Transaction[] {
  const parsed = xmlParser.parse(xmlText) as {
    ownershipDocument?: {
      issuer?: { issuerCik?: string };
      reportingOwner?: unknown;
      nonDerivativeTable?: {
        nonDerivativeTransaction?: unknown;
      };
    };
  };

  const doc = parsed?.ownershipDocument;
  if (!doc) return [];

  const owners = asArray(doc.reportingOwner) as Array<{
    reportingOwnerId?: { rptOwnerName?: string };
    reportingOwnerRelationship?: {
      isDirector?: unknown;
      isOfficer?: unknown;
      isTenPercentOwner?: unknown;
      officerTitle?: unknown;
    };
  }>;

  const firstOwner = owners[0];
  const ownerName =
    unwrapValue(firstOwner?.reportingOwnerId?.rptOwnerName) || "Unknown Insider";
  const rel = firstOwner?.reportingOwnerRelationship;
  const isDirector = toBool(rel?.isDirector);
  const isOfficer = toBool(rel?.isOfficer);
  const isTenPercentOwner = toBool(rel?.isTenPercentOwner);
  const ownerTitle = unwrapValue(rel?.officerTitle) || null;

  const txList = asArray(
    doc.nonDerivativeTable?.nonDerivativeTransaction,
  ) as Array<{
    transactionDate?: unknown;
    transactionCoding?: { transactionCode?: unknown };
    transactionAmounts?: {
      transactionShares?: unknown;
      transactionPricePerShare?: unknown;
      transactionAcquiredDisposedCode?: unknown;
    };
    postTransactionAmounts?: {
      sharesOwnedFollowingTransaction?: unknown;
    };
  }>;

  const results: ParsedForm4Transaction[] = [];

  for (const tx of txList) {
    const code = (unwrapValue(tx.transactionCoding?.transactionCode) || "").toUpperCase();
    if (!code) continue;

    const txDate = unwrapValue(tx.transactionDate) || meta.filingDate;
    const shares = toNum(tx.transactionAmounts?.transactionShares) ?? 0;
    const price = toNum(tx.transactionAmounts?.transactionPricePerShare) ?? 0;
    const adCode = unwrapValue(tx.transactionAmounts?.transactionAcquiredDisposedCode);
    const sharesAfter = toNum(
      tx.postTransactionAmounts?.sharesOwnedFollowingTransaction,
    );

    const isOpenMarket = code === "P" || code === "S";
    const totalValueUsd =
      shares > 0 && price > 0 ? Math.round(shares * price * 100) / 100 : null;

    results.push({
      accn: meta.accn,
      cik: padCik(doc.issuer?.issuerCik || meta.cik),
      filingDate: meta.filingDate,
      transactionDate: txDate,
      ownerName,
      ownerTitle,
      isDirector,
      isOfficer,
      isTenPercentOwner,
      transactionCode: code,
      acquiredDisposed: adCode,
      shares,
      pricePerShare: price,
      totalValueUsd,
      sharesAfter,
      isOpenMarket,
      primaryDocument: meta.primaryDocument ?? null,
    });
  }

  return results;
}

export function parseDailyFormIndexForForm4(
  idxText: string,
): DailyIndexForm4Row[] {
  const rows: DailyIndexForm4Row[] = [];
  const lines = idxText.split(/\r?\n/);

  for (const line of lines) {
    if (!line.startsWith("4 ")) continue;
    // Standard SEC form.YYYYMMDD.idx columns end with: ... <CIK> <YYYYMMDD> edgar/data/<cik>/<accn>.txt
    const match =
      /^(4)\s+(.+?)\s+(\d{1,10})\s+(\d{8})\s+(edgar\/data\/\d+\/(\d{10}-\d{2}-\d{6})\.txt)\s*$/.exec(
        line,
      );
    if (!match) continue;
    rows.push({
      form: match[1],
      companyName: match[2].trim(),
      cik: padCik(match[3]),
      dateFiled: `${match[4].slice(0, 4)}-${match[4].slice(4, 6)}-${match[4].slice(6, 8)}`,
      fileName: match[5],
      accn: match[6],
    });
  }

  return rows;
}
