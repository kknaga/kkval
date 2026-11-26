"use client";

import { useState } from "react";
import type { FinancialPeriodRow } from "@/db/schema";
import { formatCompactCurrency, formatCompactNumber } from "@/lib/i18n/locales";

interface FinancialChartsProps {
  annual: FinancialPeriodRow[];
  quarterly: FinancialPeriodRow[];
  currency: string;
  locale: string;
  labels: {
    title: string;
    annual: string;
    quarterly: string;
    revenueAndIncome: string;
    cashVsDebt: string;
    cashFlowAndFcf: string;
    shareCountTrend: string;
    revenue: string;
    netIncome: string;
    cash: string;
    debt: string;
    ocf: string;
    fcf: string;
    shares: string;
  };
}

interface BarPairChartProps {
  title: string;
  periods: FinancialPeriodRow[];
  labelA: string;
  labelB?: string;
  pickA: (p: FinancialPeriodRow) => number | null;
  pickB?: (p: FinancialPeriodRow) => number | null;
  colorA: string;
  colorB?: string;
  formatVal: (v: number | null) => string;
}

function DualBarSvgChart({
  title,
  periods,
  labelA,
  labelB,
  pickA,
  pickB,
  colorA,
  colorB = "#6366f1",
  formatVal,
}: BarPairChartProps) {
  const ordered = [...periods].reverse();
  const vals = ordered.flatMap((p) => {
    const out: number[] = [];
    const a = pickA(p);
    const b = pickB ? pickB(p) : null;
    if (a !== null && Number.isFinite(a)) out.push(a);
    if (b !== null && Number.isFinite(b)) out.push(b);
    return out;
  });

  if (vals.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/70">
        <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {title}
        </div>
        <p className="mt-6 text-center text-xs text-zinc-400">—</p>
      </div>
    );
  }

  const maxVal = Math.max(0, ...vals);
  const minVal = Math.min(0, ...vals);
  const range = maxVal - minVal || 1;
  const W = 440;
  const H = 160;
  const padT = 14;
  const padB = 26;
  const plotH = H - padT - padB;
  const zeroY = padT + (maxVal / range) * plotH;
  const slotW = W / Math.max(1, ordered.length);
  const barW = pickB ? Math.max(6, Math.min(18, slotW * 0.32)) : Math.max(8, Math.min(26, slotW * 0.52));

  const latest = ordered[ordered.length - 1];
  const latestA = latest ? pickA(latest) : null;
  const latestB = latest && pickB ? pickB(latest) : null;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/70">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {title}
        </h3>
        <div className="flex items-center gap-3 text-[11px] text-zinc-500 dark:text-zinc-400">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-xs" style={{ backgroundColor: colorA }} />
            {labelA}: <strong className="tabular-nums text-zinc-800 dark:text-zinc-200">{formatVal(latestA)}</strong>
          </span>
          {labelB && pickB && (
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-xs" style={{ backgroundColor: colorB }} />
              {labelB}: <strong className="tabular-nums text-zinc-800 dark:text-zinc-200">{formatVal(latestB)}</strong>
            </span>
          )}
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 h-40 w-full overflow-visible"
        role="img"
        aria-label={title}
      >
        <line
          x1={0}
          y1={zeroY}
          x2={W}
          y2={zeroY}
          stroke="currentColor"
          className="text-zinc-200 dark:text-zinc-800"
          strokeWidth={1}
        />
        {ordered.map((p, i) => {
          const cx = i * slotW + slotW / 2;
          const a = pickA(p);
          const b = pickB ? pickB(p) : null;

          const rectFor = (val: number | null, xOffset: number, fill: string) => {
            if (val === null || !Number.isFinite(val)) return null;
            const yVal = padT + ((maxVal - val) / range) * plotH;
            const y = Math.min(zeroY, yVal);
            const h = Math.max(2, Math.abs(zeroY - yVal));
            return (
              <rect
                x={cx + xOffset}
                y={y}
                width={barW}
                height={h}
                rx={2}
                fill={fill}
              >
                <title>{`${p.periodEnd}: ${formatVal(val)}`}</title>
              </rect>
            );
          };

          const showLabel =
            ordered.length <= 8 || i % 2 === 0 || i === ordered.length - 1;

          return (
            <g key={p.periodEnd}>
              {pickB
                ? (
                  <>
                    {rectFor(a, -barW - 1, colorA)}
                    {rectFor(b, 1, colorB)}
                  </>
                )
                : rectFor(a, -barW / 2, colorA)}
              {showLabel && (
                <text
                  x={cx}
                  y={H - 6}
                  textAnchor="middle"
                  fontSize="9"
                  className="fill-zinc-400 dark:fill-zinc-500"
                >
                  {p.periodEnd.slice(2, 7)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function FinancialCharts({
  annual,
  quarterly,
  currency,
  locale,
  labels,
}: FinancialChartsProps) {
  const [mode, setMode] = useState<"annual" | "quarterly">(
    annual.length >= 2 ? "annual" : "quarterly",
  );

  const periods =
    mode === "annual" ? annual.slice(0, 8) : quarterly.slice(0, 12);

  const fmtCurr = (v: number | null) =>
    formatCompactCurrency(v, currency, locale);
  const fmtShares = (v: number | null) => formatCompactNumber(v, locale);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
          {labels.title}
        </h2>
        <div
          role="tablist"
          className="inline-flex rounded-lg border border-zinc-200 bg-zinc-100 p-0.5 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === "annual"}
            onClick={() => setMode("annual")}
            className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
              mode === "annual"
                ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-zinc-100"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            }`}
          >
            {labels.annual}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "quarterly"}
            onClick={() => setMode("quarterly")}
            className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
              mode === "quarterly"
                ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-zinc-100"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            }`}
          >
            {labels.quarterly}
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <DualBarSvgChart
          title={labels.revenueAndIncome}
          periods={periods}
          labelA={labels.revenue}
          labelB={labels.netIncome}
          pickA={(p) => p.revenue}
          pickB={(p) => p.netIncome}
          colorA="#10b981"
          colorB="#3b82f6"
          formatVal={fmtCurr}
        />
        <DualBarSvgChart
          title={labels.cashVsDebt}
          periods={periods}
          labelA={labels.cash}
          labelB={labels.debt}
          pickA={(p) => p.totalLiquidity}
          pickB={(p) => p.totalDebt}
          colorA="#14b8a6"
          colorB="#f43f5e"
          formatVal={fmtCurr}
        />
        <DualBarSvgChart
          title={labels.cashFlowAndFcf}
          periods={periods}
          labelA={labels.ocf}
          labelB={labels.fcf}
          pickA={(p) => p.operatingCashFlow}
          pickB={(p) => p.freeCashFlow}
          colorA="#0ea5e9"
          colorB="#8b5cf6"
          formatVal={fmtCurr}
        />
        <DualBarSvgChart
          title={labels.shareCountTrend}
          periods={periods}
          labelA={labels.shares}
          pickA={(p) => p.sharesOutstanding}
          colorA="#f59e0b"
          formatVal={fmtShares}
        />
      </div>
    </section>
  );
}
