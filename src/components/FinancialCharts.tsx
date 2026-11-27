"use client";

import { useState } from "react";
import type { FinancialPeriodRow } from "@/db/schema";
import {
  formatCompactCurrency,
  formatCompactNumber,
  formatPercent,
} from "@/lib/i18n/locales";

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

interface ContextRow {
  label: string;
  value: string;
}

interface InteractiveChartProps {
  title: string;
  periods: FinancialPeriodRow[];
  labelA: string;
  labelB?: string;
  pickA: (p: FinancialPeriodRow) => number | null;
  pickB?: (p: FinancialPeriodRow) => number | null;
  colorA: string;
  colorB?: string;
  formatVal: (v: number | null) => string;
  formatAxisVal: (v: number) => string;
  showTrendLine?: boolean;
  buildContext: (
    p: FinancialPeriodRow,
    prev: FinancialPeriodRow | undefined,
    first: FinancialPeriodRow | undefined,
  ) => ContextRow[];
}

function pctDelta(curr: number | null, prev: number | null | undefined): number | null {
  if (
    curr === null ||
    prev === null ||
    prev === undefined ||
    !Number.isFinite(curr) ||
    !Number.isFinite(prev) ||
    Math.abs(prev) < 1e-9
  ) {
    return null;
  }
  return ((curr - prev) / Math.abs(prev)) * 100;
}

function InteractiveFinancialChart({
  title,
  periods,
  labelA,
  labelB,
  pickA,
  pickB,
  colorA,
  colorB = "#3b82f6",
  formatVal,
  formatAxisVal,
  showTrendLine = false,
  buildContext,
}: InteractiveChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
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
        <p className="mt-8 text-center text-xs text-zinc-400">—</p>
      </div>
    );
  }

  const rawMax = Math.max(0, ...vals);
  const rawMin = Math.min(0, ...vals);
  const maxVal = rawMax === 0 && rawMin === 0 ? 1 : rawMax * 1.08;
  const minVal = rawMin < 0 ? rawMin * 1.08 : 0;
  const range = maxVal - minVal || 1;

  const W = 480;
  const H = 190;
  const padL = 48;
  const padR = 10;
  const padT = 16;
  const padB = 26;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const zeroY = padT + (maxVal / range) * plotH;
  const slotW = plotW / Math.max(1, ordered.length);
  const barW = pickB
    ? Math.max(6, Math.min(18, slotW * 0.32))
    : Math.max(8, Math.min(26, slotW * 0.5));

  const ticks = [
    maxVal,
    minVal + range * 0.66,
    minVal + range * 0.33,
    minVal,
  ];

  const activeIdx =
    hoveredIdx !== null && hoveredIdx >= 0 && hoveredIdx < ordered.length
      ? hoveredIdx
      : null;
  const readoutPeriod =
    activeIdx !== null ? ordered[activeIdx] : ordered[ordered.length - 1];
  const readoutA = readoutPeriod ? pickA(readoutPeriod) : null;
  const readoutB = readoutPeriod && pickB ? pickB(readoutPeriod) : null;

  const trendPoints = showTrendLine
    ? ordered
        .map((p, i) => {
          const val = pickA(p);
          if (val === null || !Number.isFinite(val)) return null;
          const x = padL + i * slotW + slotW / 2;
          const y = padT + ((maxVal - val) / range) * plotH;
          return { x, y, val };
        })
        .filter((pt): pt is { x: number; y: number; val: number } => pt !== null)
    : [];

  const hoveredPeriod = activeIdx !== null ? ordered[activeIdx] : null;
  const hoveredPrev =
    activeIdx !== null && activeIdx > 0 ? ordered[activeIdx - 1] : undefined;
  const hoveredContext = hoveredPeriod
    ? buildContext(hoveredPeriod, hoveredPrev, ordered[0])
    : [];

  const alignRightTooltip =
    activeIdx !== null && activeIdx >= Math.ceil(ordered.length / 2);

  return (
    <div className="relative rounded-2xl border border-zinc-200/90 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900/70">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
            {title}
          </h3>
          <div className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
            {readoutPeriod ? readoutPeriod.periodEnd : ""}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-zinc-500 dark:text-zinc-400">
          <span className="inline-flex items-center gap-1">
            <span
              className="h-2 w-2 rounded-xs"
              style={{ backgroundColor: colorA }}
            />
            {labelA}:{" "}
            <strong className="tabular-nums text-zinc-900 dark:text-zinc-100">
              {formatVal(readoutA)}
            </strong>
          </span>
          {labelB && pickB && (
            <span className="inline-flex items-center gap-1">
              <span
                className="h-2 w-2 rounded-xs"
                style={{ backgroundColor: colorB }}
              />
              {labelB}:{" "}
              <strong className="tabular-nums text-zinc-900 dark:text-zinc-100">
                {formatVal(readoutB)}
              </strong>
            </span>
          )}
        </div>
      </div>

      <div
        className="relative mt-2"
        onMouseLeave={() => setHoveredIdx(null)}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-48 w-full overflow-visible select-none"
          role="img"
          aria-label={title}
        >
          {/* Horizontal gridlines + Y-axis labels */}
          {ticks.map((tickVal, idx) => {
            const y = padT + ((maxVal - tickVal) / range) * plotH;
            return (
              <g key={idx}>
                <line
                  x1={padL}
                  y1={y}
                  x2={W - padR}
                  y2={y}
                  stroke="currentColor"
                  strokeDasharray="2 3"
                  className="text-zinc-200 dark:text-zinc-800"
                  strokeWidth={1}
                />
                <text
                  x={padL - 6}
                  y={y + 3}
                  textAnchor="end"
                  fontSize="9"
                  className="tabular-nums fill-zinc-400 dark:fill-zinc-500"
                >
                  {formatAxisVal(tickVal)}
                </text>
              </g>
            );
          })}

          {/* Zero baseline */}
          <line
            x1={padL}
            y1={zeroY}
            x2={W - padR}
            y2={zeroY}
            stroke="currentColor"
            className="text-zinc-300 dark:text-zinc-700"
            strokeWidth={1}
          />

          {/* Bars + interactive column hit zones */}
          {ordered.map((p, i) => {
            const colX = padL + i * slotW;
            const cx = colX + slotW / 2;
            const a = pickA(p);
            const b = pickB ? pickB(p) : null;
            const isActive = activeIdx === i;

            const rectFor = (
              val: number | null,
              xOffset: number,
              fill: string,
            ) => {
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
                  opacity={activeIdx === null || isActive ? 1 : 0.45}
                />
              );
            };

            const showLabel =
              ordered.length <= 8 || i % 2 === 0 || i === ordered.length - 1;

            return (
              <g key={p.periodEnd}>
                {isActive && (
                  <rect
                    x={colX + 1}
                    y={padT}
                    width={Math.max(4, slotW - 2)}
                    height={plotH}
                    rx={4}
                    className="fill-zinc-200/50 dark:fill-zinc-800/50"
                  />
                )}
                {pickB ? (
                  <>
                    {rectFor(a, -barW - 1, colorA)}
                    {rectFor(b, 1, colorB)}
                  </>
                ) : (
                  rectFor(a, -barW / 2, colorA)
                )}
                {showLabel && (
                  <text
                    x={cx}
                    y={H - 6}
                    textAnchor="middle"
                    fontSize="9"
                    className={
                      isActive
                        ? "font-semibold fill-zinc-800 dark:fill-zinc-200"
                        : "fill-zinc-400 dark:fill-zinc-500"
                    }
                  >
                    {p.periodEnd.slice(2, 7)}
                  </text>
                )}
                <rect
                  x={colX}
                  y={padT}
                  width={slotW}
                  height={plotH + padB}
                  fill="transparent"
                  className="cursor-crosshair outline-none"
                  tabIndex={0}
                  aria-label={`${p.periodEnd}: ${labelA} ${formatVal(a)}${labelB && pickB ? `, ${labelB} ${formatVal(b)}` : ""}`}
                  onMouseEnter={() => setHoveredIdx(i)}
                  onFocus={() => setHoveredIdx(i)}
                  onBlur={() => setHoveredIdx(null)}
                  onClick={() =>
                    setHoveredIdx((prev) => (prev === i ? null : i))
                  }
                />
              </g>
            );
          })}

          {/* Optional overlaid trend line (used for share count dilution) */}
          {showTrendLine && trendPoints.length >= 2 && (
            <>
              <polyline
                fill="none"
                stroke="#d97706"
                strokeWidth={2}
                strokeLinejoin="round"
                points={trendPoints.map((pt) => `${pt.x},${pt.y}`).join(" ")}
                pointerEvents="none"
              />
              {trendPoints.map((pt, idx) => (
                <circle
                  key={idx}
                  cx={pt.x}
                  cy={pt.y}
                  r={activeIdx === idx ? 4.5 : 2.5}
                  fill="#d97706"
                  stroke="#ffffff"
                  strokeWidth={1}
                  pointerEvents="none"
                />
              ))}
            </>
          )}
        </svg>

        {/* Rich Interactive Hover Tooltip */}
        {hoveredPeriod && (
          <div
            role="status"
            className={`pointer-events-none absolute top-1 z-20 w-56 rounded-lg border border-zinc-200 bg-white/95 p-2.5 text-[11px] shadow-lg backdrop-blur-xs dark:border-zinc-700 dark:bg-zinc-950/95 ${
              alignRightTooltip ? "left-12" : "right-2"
            }`}
          >
            <div className="flex items-center justify-between border-b border-zinc-200 pb-1 font-semibold text-zinc-900 dark:border-zinc-800 dark:text-zinc-100">
              <span className="tabular-nums">{hoveredPeriod.periodEnd}</span>
              <span className="text-[10px] font-normal text-zinc-500 dark:text-zinc-400">
                {hoveredPeriod.periodType === "annual" ? "FY" : "Q"}
                {hoveredPeriod.isDecumulated ? " • calc" : ""}
              </span>
            </div>

            <div className="mt-1.5 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300">
                  <span
                    className="h-2 w-2 rounded-xs"
                    style={{ backgroundColor: colorA }}
                  />
                  {labelA}
                </span>
                <span className="tabular-nums font-semibold text-zinc-900 dark:text-zinc-100">
                  {formatVal(pickA(hoveredPeriod))}
                </span>
              </div>

              {labelB && pickB && (
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300">
                    <span
                      className="h-2 w-2 rounded-xs"
                      style={{ backgroundColor: colorB }}
                    />
                    {labelB}
                  </span>
                  <span className="tabular-nums font-semibold text-zinc-900 dark:text-zinc-100">
                    {formatVal(pickB(hoveredPeriod))}
                  </span>
                </div>
              )}
            </div>

            {hoveredContext.length > 0 && (
              <div className="mt-1.5 space-y-0.5 border-t border-zinc-200 pt-1.5 dark:border-zinc-800">
                {hoveredContext.map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between gap-2 text-[10px]"
                  >
                    <span className="text-zinc-500 dark:text-zinc-400">
                      {row.label}
                    </span>
                    <span className="tabular-nums font-medium text-zinc-800 dark:text-zinc-200">
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
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
  const fmtCurrAxis = (v: number) =>
    formatCompactCurrency(v, currency, locale);
  const fmtShares = (v: number | null) => formatCompactNumber(v, locale);
  const fmtSharesAxis = (v: number) => formatCompactNumber(v, locale);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
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

      <div className="grid gap-6 md:grid-cols-2">
        <InteractiveFinancialChart
          title={labels.revenueAndIncome}
          periods={periods}
          labelA={labels.revenue}
          labelB={labels.netIncome}
          pickA={(p) => p.revenue}
          pickB={(p) => p.netIncome}
          colorA="#10b981"
          colorB="#3b82f6"
          formatVal={fmtCurr}
          formatAxisVal={fmtCurrAxis}
          buildContext={(p, prev) => {
            const rows: ContextRow[] = [];
            const revChange = pctDelta(p.revenue, prev?.revenue);
            if (revChange !== null) {
              rows.push({
                label: `${labels.revenue} Δ`,
                value: formatPercent(revChange),
              });
            }
            if (p.revenue && p.revenue > 0 && p.netIncome !== null) {
              rows.push({
                label: "Net Margin",
                value: `${((p.netIncome / p.revenue) * 100).toFixed(1)}%`,
              });
            }
            if (p.revenue && p.revenue > 0 && p.grossProfit !== null) {
              rows.push({
                label: "Gross Margin",
                value: `${((p.grossProfit / p.revenue) * 100).toFixed(1)}%`,
              });
            }
            return rows;
          }}
        />

        <InteractiveFinancialChart
          title={labels.cashVsDebt}
          periods={periods}
          labelA={labels.cash}
          labelB={labels.debt}
          pickA={(p) => p.totalLiquidity}
          pickB={(p) => p.totalDebt}
          colorA="#14b8a6"
          colorB="#f43f5e"
          formatVal={fmtCurr}
          formatAxisVal={fmtCurrAxis}
          buildContext={(p) => {
            const rows: ContextRow[] = [];
            if (p.totalLiquidity !== null) {
              const netCash = p.totalLiquidity - (p.totalDebt ?? 0);
              rows.push({ label: "Net Cash", value: fmtCurr(netCash) });
            }
            if (
              p.totalDebt !== null &&
              p.totalLiquidity !== null &&
              p.totalLiquidity > 0
            ) {
              rows.push({
                label: "Debt / Liquidity",
                value: `${(p.totalDebt / p.totalLiquidity).toFixed(2)}x`,
              });
            }
            return rows;
          }}
        />

        <InteractiveFinancialChart
          title={labels.cashFlowAndFcf}
          periods={periods}
          labelA={labels.ocf}
          labelB={labels.fcf}
          pickA={(p) => p.operatingCashFlow}
          pickB={(p) => p.freeCashFlow}
          colorA="#0ea5e9"
          colorB="#8b5cf6"
          formatVal={fmtCurr}
          formatAxisVal={fmtCurrAxis}
          buildContext={(p) => {
            const rows: ContextRow[] = [];
            if (p.capex !== null) {
              rows.push({ label: "CapEx", value: fmtCurr(p.capex) });
            }
            if (p.revenue && p.revenue > 0 && p.freeCashFlow !== null) {
              rows.push({
                label: "FCF Margin",
                value: `${((p.freeCashFlow / p.revenue) * 100).toFixed(1)}%`,
              });
            }
            return rows;
          }}
        />

        <InteractiveFinancialChart
          title={labels.shareCountTrend}
          periods={periods}
          labelA={labels.shares}
          pickA={(p) => p.sharesOutstanding}
          colorA="#f59e0b"
          formatVal={fmtShares}
          formatAxisVal={fmtSharesAxis}
          showTrendLine
          buildContext={(p, prev, first) => {
            const rows: ContextRow[] = [];
            const stepDelta = pctDelta(
              p.sharesOutstanding,
              prev?.sharesOutstanding,
            );
            if (stepDelta !== null) {
              rows.push({
                label: "Period Δ",
                value: formatPercent(stepDelta),
              });
            }
            if (first && first.periodEnd !== p.periodEnd) {
              const cumDelta = pctDelta(
                p.sharesOutstanding,
                first.sharesOutstanding,
              );
              if (cumDelta !== null) {
                rows.push({
                  label: `Since ${first.periodEnd.slice(0, 4)}`,
                  value: formatPercent(cumDelta),
                });
              }
            }
            return rows;
          }}
        />
      </div>
    </section>
  );
}
