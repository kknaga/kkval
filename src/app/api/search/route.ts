import { NextResponse } from "next/server";
import { searchCompanies } from "@/lib/queries/companies";
import {
  rankTickerMatches,
  searchSecTickerDirectory,
} from "@/lib/sec/ticker-directory";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  if (!q.trim()) {
    return NextResponse.json({ results: [] });
  }

  const [dbHits, secHits] = await Promise.all([
    searchCompanies(q, 10),
    searchSecTickerDirectory(q, 10),
  ]);

  const merged = rankTickerMatches(
    [
      ...dbHits.map((r) => ({ ...r, indexed: true })),
      ...secHits.map((r) => ({
        ticker: r.ticker,
        name: r.name,
        exchange: r.exchange,
        indexed: false,
      })),
    ],
    q,
    10,
  );

  return NextResponse.json(
    { results: merged },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    },
  );
}
