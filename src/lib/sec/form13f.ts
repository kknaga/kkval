import yauzl from "yauzl";
import { padCik } from "./client";

export interface Raw13fHolding {
  quarterEnd: string;
  managerCik: string;
  managerName: string;
  cusip: string;
  shares: number | null;
  valueUsd: number | null;
  putCall: string;
  filingAccn: string;
}

function parseTsvLine(line: string): string[] {
  return line.split("\t").map((col) => col.trim());
}

async function readZipEntryText(
  zipPath: string,
  targetSuffix: string,
): Promise<string | null> {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) {
        reject(err ?? new Error("Failed to open zip"));
        return;
      }

      let found = false;
      zipfile.readEntry();

      zipfile.on("entry", (entry) => {
        if (entry.fileName.toLowerCase().endsWith(targetSuffix.toLowerCase())) {
          found = true;
          zipfile.openReadStream(entry, (streamErr, readStream) => {
            if (streamErr || !readStream) {
              zipfile.close();
              reject(streamErr ?? new Error("Failed reading zip entry"));
              return;
            }
            const chunks: Buffer[] = [];
            readStream.on("data", (c: Buffer) => chunks.push(c));
            readStream.on("end", () => {
              zipfile.close();
              resolve(Buffer.concat(chunks).toString("utf8"));
            });
            readStream.on("error", (e) => {
              zipfile.close();
              reject(e);
            });
          });
        } else {
          zipfile.readEntry();
        }
      });

      zipfile.on("end", () => {
        if (!found) resolve(null);
      });
      zipfile.on("error", reject);
    });
  });
}

async function streamZipEntryLines(
  zipPath: string,
  targetSuffix: string,
  onLine: (line: string, lineIndex: number) => void,
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) {
        reject(err ?? new Error("Failed to open zip"));
        return;
      }

      let matched = false;
      zipfile.readEntry();

      zipfile.on("entry", (entry) => {
        if (entry.fileName.toLowerCase().endsWith(targetSuffix.toLowerCase())) {
          matched = true;
          zipfile.openReadStream(entry, (streamErr, readStream) => {
            if (streamErr || !readStream) {
              zipfile.close();
              reject(streamErr ?? new Error("Failed reading zip entry"));
              return;
            }
            let leftover = "";
            let lineIdx = 0;
            readStream.setEncoding("utf8");
            readStream.on("data", (chunk: string) => {
              const combined = leftover + chunk;
              const lines = combined.split(/\r?\n/);
              leftover = lines.pop() ?? "";
              for (const ln of lines) {
                if (ln.length > 0) onLine(ln, lineIdx++);
              }
            });
            readStream.on("end", () => {
              if (leftover.length > 0) onLine(leftover, lineIdx++);
              zipfile.close();
              resolve(true);
            });
            readStream.on("error", (e) => {
              zipfile.close();
              reject(e);
            });
          });
        } else {
          zipfile.readEntry();
        }
      });

      zipfile.on("end", () => {
        if (!matched) resolve(false);
      });
      zipfile.on("error", reject);
    });
  });
}

export async function parseDera13fZip(
  zipPath: string,
  trackedCusips: Set<string>,
): Promise<Raw13fHolding[]> {
  const submissionTxt = await readZipEntryText(zipPath, "SUBMISSION.tsv");
  const coverTxt = await readZipEntryText(zipPath, "COVERPAGE.tsv");
  if (!submissionTxt || !coverTxt) {
    throw new Error("DERA 13F ZIP missing SUBMISSION.tsv or COVERPAGE.tsv");
  }

  const subMeta = new Map<
    string,
    { managerCik: string; quarterEnd: string }
  >();
  {
    const lines = submissionTxt.split(/\r?\n/);
    const header = parseTsvLine(lines[0] ?? "").map((h) => h.toUpperCase());
    const accIdx = header.indexOf("ACCESSION_NUMBER");
    const cikIdx = header.indexOf("CIK");
    const perIdx = header.indexOf("PERIODOFREPORT");
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i]) continue;
      const cols = parseTsvLine(lines[i]);
      const accn = cols[accIdx];
      const cik = cols[cikIdx];
      const per = cols[perIdx];
      if (accn && cik && per) {
        subMeta.set(accn, { managerCik: padCik(cik), quarterEnd: per });
      }
    }
  }

  const managerNames = new Map<string, string>();
  {
    const lines = coverTxt.split(/\r?\n/);
    const header = parseTsvLine(lines[0] ?? "").map((h) => h.toUpperCase());
    const accIdx = header.indexOf("ACCESSION_NUMBER");
    const nameIdx = header.indexOf("FILINGMANAGER_NAME");
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i]) continue;
      const cols = parseTsvLine(lines[i]);
      const accn = cols[accIdx];
      const name = cols[nameIdx];
      if (accn && name) {
        managerNames.set(accn, name);
      }
    }
  }

  // Aggregate by (quarterEnd, managerCik, cusip, putCall) in case a 13F splits across sub-managers
  const agg = new Map<string, Raw13fHolding>();
  let idxMap: Record<string, number> | null = null;

  await streamZipEntryLines(zipPath, "INFOTABLE.tsv", (line, lineIdx) => {
    const cols = parseTsvLine(line);
    if (lineIdx === 0) {
      const header = cols.map((h) => h.toUpperCase());
      idxMap = {
        accn: header.indexOf("ACCESSION_NUMBER"),
        cusip: header.indexOf("CUSIP"),
        value: header.indexOf("VALUE"),
        shares: header.indexOf("SSHPRNAMT"),
        putCall: header.indexOf("PUTCALL"),
      };
      return;
    }
    if (!idxMap) return;
    const cusip = (cols[idxMap.cusip] ?? "").toUpperCase();
    if (!cusip || (trackedCusips.size > 0 && !trackedCusips.has(cusip))) {
      return;
    }

    const accn = cols[idxMap.accn];
    const sub = subMeta.get(accn);
    if (!sub) return;

    const putCall = (cols[idxMap.putCall] ?? "").toUpperCase();
    const shares = Number.parseFloat(cols[idxMap.shares] ?? "");
    const valueUsd = Number.parseFloat(cols[idxMap.value] ?? "");
    const managerName = managerNames.get(accn) ?? `Manager ${sub.managerCik}`;

    const key = `${sub.quarterEnd}|${sub.managerCik}|${cusip}|${putCall}`;
    const existing = agg.get(key);
    if (existing) {
      existing.shares =
        (existing.shares ?? 0) + (Number.isFinite(shares) ? shares : 0);
      existing.valueUsd =
        (existing.valueUsd ?? 0) + (Number.isFinite(valueUsd) ? valueUsd : 0);
    } else {
      agg.set(key, {
        quarterEnd: sub.quarterEnd,
        managerCik: sub.managerCik,
        managerName,
        cusip,
        shares: Number.isFinite(shares) ? shares : null,
        valueUsd: Number.isFinite(valueUsd) ? valueUsd : null,
        putCall,
        filingAccn: accn,
      });
    }
  });

  return Array.from(agg.values());
}
