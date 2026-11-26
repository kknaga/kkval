import { NextResponse } from "next/server";
import { getIndexableCount } from "@/lib/queries/companies";

export async function GET() {
  const indexableCompanies = await getIndexableCount();
  return NextResponse.json({
    ok: true,
    service: "kkval",
    indexableCompanies,
    timestamp: new Date().toISOString(),
  });
}
