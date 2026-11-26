import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

export interface SecTickerExchangeRow {
  cik: string;
  name: string;
  ticker: string;
  exchange: string | null;
}

export interface SecSubmissionsJson {
  cik: string;
  entityType?: string;
  sic?: string;
  sicDescription?: string;
  name: string;
  tickers?: string[];
  exchanges?: string[];
  category?: string;
  fiscalYearEnd?: string;
  stateOfIncorporation?: string;
  filings: {
    recent: {
      accessionNumber: string[];
      filingDate: string[];
      reportDate: string[];
      form: string[];
      primaryDocument: string[];
      primaryDocDescription?: string[];
    };
  };
}

export interface SecFactEntry {
  start?: string;
  end: string;
  val: number;
  accn: string;
  fy?: number;
  fp?: string;
  form: string;
  filed: string;
  frame?: string;
}

export interface SecCompanyFactsJson {
  cik: number | string;
  entityName?: string;
  facts: Record<
    string,
    Record<
      string,
      {
        label?: string;
        description?: string;
        units: Record<string, SecFactEntry[]>;
      }
    >
  >;
}

const MAX_REQUESTS_PER_SECOND = 8;
const MIN_INTERVAL_MS = Math.ceil(1000 / MAX_REQUESTS_PER_SECOND);
let lastRequestAt = 0;
let queueChain: Promise<void> = Promise.resolve();

export function getSecUserAgent(): string {
  return process.env.SEC_USER_AGENT?.trim() || "kkval.com contact@kkval.com";
}

export function padCik(cik: string | number): string {
  const digits = String(cik).replace(/\D/g, "");
  return digits.padStart(10, "0");
}

export function unpadCik(cik: string | number): string {
  const digits = String(cik).replace(/\D/g, "").replace(/^0+/, "");
  return digits || "0";
}

export function buildSecFilingUrl(
  cik: string,
  accn: string,
  primaryDocument?: string | null,
): string {
  const cikNum = unpadCik(cik);
  const accnNoDash = accn.replace(/-/g, "");
  if (primaryDocument) {
    const cleanDoc = primaryDocument.replace(/^\/+/, "");
    return `https://www.sec.gov/Archives/edgar/data/${cikNum}/${accnNoDash}/${cleanDoc}`;
  }
  return `https://www.sec.gov/Archives/edgar/data/${cikNum}/${accnNoDash}/${accn}-index.htm`;
}

export function stripXsltPrefix(primaryDocument: string): string {
  const parts = primaryDocument.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? primaryDocument;
}

async function scheduleSecSlot(): Promise<void> {
  const prev = queueChain;
  let release!: () => void;
  queueChain = new Promise<void>((resolve) => {
    release = resolve;
  });
  await prev;
  const now = Date.now();
  const waitMs = Math.max(0, lastRequestAt + MIN_INTERVAL_MS - now);
  if (waitMs > 0) {
    await new Promise((r) => setTimeout(r, waitMs));
  }
  lastRequestAt = Date.now();
  release();
}

export async function secFetch(
  url: string,
  options: { retries?: number; accept?: string } = {},
): Promise<Response> {
  const retries = options.retries ?? 3;
  for (let attempt = 0; attempt <= retries; attempt++) {
    await scheduleSecSlot();
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": getSecUserAgent(),
          Accept: options.accept ?? "application/json,text/plain,*/*",
        },
        signal: AbortSignal.timeout(30_000),
      });

      if (res.status === 429 || res.status >= 500) {
        if (attempt < retries) {
          const backoffMs = 800 * Math.pow(2, attempt);
          await new Promise((r) => setTimeout(r, backoffMs));
          continue;
        }
      }
      return res;
    } catch (err) {
      if (attempt >= retries) throw err;
      const backoffMs = 800 * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, backoffMs));
    }
  }
  throw new Error(`SEC fetch failed after retries: ${url}`);
}

export async function fetchSecJson<T>(url: string): Promise<T | null> {
  const res = await secFetch(url, { accept: "application/json" });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`SEC HTTP ${res.status} for ${url}`);
  }
  return (await res.json()) as T;
}

export async function fetchSecText(url: string): Promise<string | null> {
  const res = await secFetch(url, { accept: "text/plain,text/html,application/xml,*/*" });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`SEC HTTP ${res.status} for ${url}`);
  }
  return await res.text();
}

export async function fetchCompanyTickersExchange(): Promise<
  SecTickerExchangeRow[]
> {
  const data = await fetchSecJson<{
    fields: string[];
    data: Array<[number, string, string, string | null]>;
  }>("https://www.sec.gov/files/company_tickers_exchange.json");

  if (!data?.data) return [];
  return data.data
    .filter((row) => Boolean(row[2]))
    .map((row) => ({
      cik: padCik(row[0]),
      name: String(row[1] ?? "").trim(),
      ticker: String(row[2]).trim().toUpperCase(),
      exchange: row[3] ? String(row[3]).trim() : null,
    }));
}

export async function fetchSubmissions(
  cik: string,
): Promise<SecSubmissionsJson | null> {
  return fetchSecJson<SecSubmissionsJson>(
    `https://data.sec.gov/submissions/CIK${padCik(cik)}.json`,
  );
}

export async function fetchCompanyFacts(
  cik: string,
): Promise<SecCompanyFactsJson | null> {
  return fetchSecJson<SecCompanyFactsJson>(
    `https://data.sec.gov/api/xbrl/companyfacts/CIK${padCik(cik)}.json`,
  );
}

export async function fetchForm4Xml(
  cik: string,
  accn: string,
  primaryDocument: string,
): Promise<string | null> {
  const rawDoc = stripXsltPrefix(primaryDocument);
  const url = buildSecFilingUrl(cik, accn, rawDoc);
  return fetchSecText(url);
}

export async function fetchDailyFormIndex(
  dateStr: string,
): Promise<string | null> {
  // dateStr format: YYYYMMDD
  const year = dateStr.slice(0, 4);
  const month = Number.parseInt(dateStr.slice(4, 6), 10);
  const qtr = Math.ceil(month / 3);
  const url = `https://www.sec.gov/Archives/edgar/daily-index/${year}/QTR${qtr}/form.${dateStr}.idx`;
  return fetchSecText(url);
}

export async function discoverLatestDera13fZipUrl(): Promise<string | null> {
  const html = await fetchSecText(
    "https://www.sec.gov/data-research/sec-markets-data/form-13f-data-sets",
  );
  if (!html) return null;
  const matches = html.match(/href="([^"]+\.zip)"/gi);
  if (!matches || matches.length === 0) return null;
  for (const m of matches) {
    const hrefMatch = /href="([^"]+\.zip)"/i.exec(m);
    if (hrefMatch?.[1]) {
      const href = hrefMatch[1];
      return href.startsWith("http") ? href : `https://www.sec.gov${href}`;
    }
  }
  return null;
}

export async function downloadFileIfStale(
  url: string,
  destPath: string,
  maxAgeHours = 20,
): Promise<string> {
  await fsp.mkdir(path.dirname(destPath), { recursive: true });
  try {
    const stat = await fsp.stat(destPath);
    const ageHours = (Date.now() - stat.mtimeMs) / (1000 * 60 * 60);
    if (stat.size > 1024 && ageHours < maxAgeHours) {
      return destPath;
    }
  } catch {
    // File does not exist yet
  }

  const tmpPath = `${destPath}.tmp`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": getSecUserAgent(),
      Accept: "*/*",
    },
    signal: AbortSignal.timeout(30 * 60 * 1000),
  });
  if (!res.ok || !res.body) {
    throw new Error(`Failed downloading ${url}: HTTP ${res.status}`);
  }
  await pipeline(
    Readable.fromWeb(res.body as unknown as import("node:stream/web").ReadableStream),
    fs.createWriteStream(tmpPath),
  );
  await fsp.rename(tmpPath, destPath);
  return destPath;
}
