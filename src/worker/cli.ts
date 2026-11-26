import "dotenv/config";
import { closeDb } from "@/db";
import {
  runBulkIngestion,
  runDailyForm4Ingestion,
  runQuarterly13fIngestion,
  runSampleIngestion,
} from "./ingest";

async function main() {
  const mode = process.argv[2] ?? "sample";
  const extra = process.argv.slice(3);

  try {
    if (mode === "sample") {
      const tickers = extra.length > 0 ? extra : undefined;
      const res = await runSampleIngestion(tickers);
      console.log("[cli] Sample ingestion complete:", res);
    } else if (mode === "bulk") {
      const res = await runBulkIngestion();
      console.log("[cli] Bulk ingestion complete:", res);
    } else if (mode === "form4") {
      const days = extra[0] ? Number.parseInt(extra[0], 10) : 3;
      const res = await runDailyForm4Ingestion(days);
      console.log("[cli] Form 4 ingestion complete:", res);
    } else if (mode === "13f") {
      const res = await runQuarterly13fIngestion();
      console.log("[cli] 13F ingestion complete:", res);
    } else {
      console.error(`Unknown mode: ${mode}. Use sample | bulk | form4 | 13f`);
      process.exitCode = 1;
    }
  } finally {
    await closeDb();
  }
}

main().catch((err) => {
  console.error("[cli] Fatal error:", err);
  process.exit(1);
});
