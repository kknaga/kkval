import "dotenv/config";
import { closeDb } from "@/db";
import {
  runBulkIngestion,
  runDailyForm4Ingestion,
  runQuarterly13fIngestion,
} from "./ingest";

let running = false;
let shuttingDown = false;
let lastRunDate = "";

function getEasternDateHour(): { ymd: string; hour: number; dayOfWeek: number } {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    weekday: "short",
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
  const ymd = `${parts.year}-${parts.month}-${parts.day}`;
  const hour = Number.parseInt(parts.hour ?? "0", 10);
  const dayOfWeek = parts.weekday === "Sun" ? 0 : 1;
  return { ymd, hour, dayOfWeek };
}

async function tick() {
  if (running || shuttingDown) return;
  const { ymd, hour, dayOfWeek } = getEasternDateHour();
  // Run nightly at or after 04:00 ET (after SEC 3am ET bulk ZIP rebuild)
  if (hour < 4 || lastRunDate === ymd) return;

  running = true;
  lastRunDate = ymd;
  console.log(`[kkval-worker] Starting nightly SEC pipeline for ${ymd}...`);

  try {
    await runBulkIngestion();
    await runDailyForm4Ingestion(3);
    if (dayOfWeek === 0) {
      await runQuarterly13fIngestion();
    }
    console.log(`[kkval-worker] Nightly SEC pipeline finished for ${ymd}.`);
  } catch (err) {
    console.error("[kkval-worker] Nightly pipeline failed:", err);
  } finally {
    running = false;
  }
}

async function main() {
  console.log("[kkval-worker] Scheduler started (nightly refresh at 04:00 ET).");
  const timer = setInterval(() => {
    void tick();
  }, 5 * 60 * 1000);

  const shutdown = async () => {
    shuttingDown = true;
    clearInterval(timer);
    await closeDb();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("[kkval-worker] Fatal error:", err);
  process.exit(1);
});
