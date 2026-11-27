import type { CompanyHealthSnapshotRow, CompanyRow } from "@/db/schema";
import { formatCompactCurrency, formatPercent } from "@/lib/i18n/locales";
import {
  getMessages,
  renderHealthSummary,
  renderHealthWarning,
} from "@/lib/i18n/messages";

interface HealthCheckCardProps {
  company: CompanyRow;
  snapshot: CompanyHealthSnapshotRow;
  locale: string;
}

const VERDICT_STYLES: Record<string, string> = {
  healthy:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/60 dark:text-emerald-300",
  watch:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/60 dark:text-amber-300",
  high_risk:
    "border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-900/70 dark:bg-orange-950/60 dark:text-orange-300",
  critical:
    "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/70 dark:bg-rose-950/60 dark:text-rose-300",
  excluded:
    "border-zinc-200 bg-zinc-100 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300",
};

const WARNING_DOT: Record<string, string> = {
  critical: "bg-rose-500",
  warn: "bg-amber-500",
  good: "bg-emerald-500",
  info: "bg-sky-500",
};

export function HealthCheckCard({
  company,
  snapshot,
  locale,
}: HealthCheckCardProps) {
  const msg = getMessages(locale);
  const currency = company.reportingCurrency || "USD";

  const runwayDisplay =
    company.entityClass === "spac" || company.entityClass === "financial"
      ? msg.company.notApplicableSector
      : snapshot.isCashFlowPositive
        ? msg.company.cashFlowPositive
        : snapshot.cashRunwayMonths !== null
          ? `${snapshot.cashRunwayMonths.toFixed(1)} ${msg.company.monthsSuffix}`
          : "—";

  const dilutionDisplay = snapshot.possibleReverseSplit
    ? msg.company.reverseSplitFlag
    : formatPercent(snapshot.shareDilution1yPct);

  const summary = renderHealthSummary(snapshot.summaryDataJson, locale);

  return (
    <section className="rounded-2xl border border-zinc-200/90 bg-white p-6 shadow-xs sm:p-8 dark:border-zinc-800 dark:bg-zinc-900/80">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200/80 pb-5 dark:border-zinc-800">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
            {msg.company.healthCheckTitle}
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {msg.entityClass[company.entityClass]}
            {company.sicDescription ? ` • ${company.sicDescription}` : ""}
          </p>
        </div>
        <span
          className={`inline-flex items-center rounded-full border px-4 py-1.5 text-xs font-semibold ${
            VERDICT_STYLES[snapshot.verdict] ?? VERDICT_STYLES.watch
          }`}
        >
          {msg.verdict[snapshot.verdict]}
        </span>
      </div>

      <p className="mt-5 max-w-3xl text-sm leading-relaxed text-zinc-600 sm:text-base dark:text-zinc-300">
        {summary}
      </p>

      <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/70 p-5 dark:border-zinc-800 dark:bg-zinc-950/60">
          <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {msg.company.cashRunway}
          </div>
          <div className="tabular-nums mt-2 text-2xl font-bold text-zinc-900 sm:text-3xl dark:text-zinc-100">
            {runwayDisplay}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/70 p-5 dark:border-zinc-800 dark:bg-zinc-950/60">
          <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {msg.company.totalLiquidity}
          </div>
          <div className="tabular-nums mt-2 text-2xl font-bold text-zinc-900 sm:text-3xl dark:text-zinc-100">
            {formatCompactCurrency(
              snapshot.totalLiquidityNative ?? snapshot.totalLiquidityUsd,
              currency,
              locale,
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/70 p-5 dark:border-zinc-800 dark:bg-zinc-950/60">
          <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {msg.company.shareDilution1y}
          </div>
          <div className="tabular-nums mt-2 text-2xl font-bold text-zinc-900 sm:text-3xl dark:text-zinc-100">
            {dilutionDisplay}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/70 p-5 dark:border-zinc-800 dark:bg-zinc-950/60">
          <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {msg.company.ttmFreeCashFlow}
          </div>
          <div className="tabular-nums mt-2 text-2xl font-bold text-zinc-900 sm:text-3xl dark:text-zinc-100">
            {formatCompactCurrency(
              snapshot.fcfTtmNative ?? snapshot.fcfTtmUsd,
              currency,
              locale,
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/70 p-5 dark:border-zinc-800 dark:bg-zinc-950/60">
          <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {msg.company.debtVsCash}
          </div>
          <div className="tabular-nums mt-2 text-2xl font-bold text-zinc-900 sm:text-3xl dark:text-zinc-100">
            {snapshot.debtToCashRatio !== null
              ? `${snapshot.debtToCashRatio.toFixed(2)}x`
              : "—"}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/70 p-5 dark:border-zinc-800 dark:bg-zinc-950/60">
          <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {msg.company.offeringFilings12m}
          </div>
          <div className="tabular-nums mt-2 text-2xl font-bold text-zinc-900 sm:text-3xl dark:text-zinc-100">
            {snapshot.offeringFilings12m}
          </div>
        </div>
      </div>

      {snapshot.warningsJson.length > 0 && (
        <ul className="mt-6 space-y-2.5 border-t border-zinc-200 pt-5 dark:border-zinc-800">
          {snapshot.warningsJson.map((w, idx) => (
            <li
              key={`${w.code}-${idx}`}
              className="flex items-start gap-2.5 text-sm text-zinc-700 dark:text-zinc-300"
            >
              <span
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                  WARNING_DOT[w.severity] ?? WARNING_DOT.info
                }`}
                aria-hidden="true"
              />
              <span>{renderHealthWarning(w, locale)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
