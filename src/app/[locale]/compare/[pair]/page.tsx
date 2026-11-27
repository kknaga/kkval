import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { cleanCompanyName } from "@/lib/format-stake-pct";
import {
  formatCompactCurrency,
  formatPercent,
  localizePath,
  normalizeLocaleSlug,
} from "@/lib/i18n/locales";
import { formatMessage, getMessages } from "@/lib/i18n/messages";
import { getFullCompanyProfile } from "@/lib/queries/companies";
import {
  buildAbsoluteLocaleAlternates,
  canonicalizeComparePair,
  parseCompareSlug,
} from "@/lib/seo";
import { AdSlot } from "@/components/AdSlot";
import { CompanyBadge } from "@/components/CompanyBadge";

export const revalidate = 3600;

interface PageProps {
  params: Promise<{
    locale: string;
    pair: string;
  }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale: rawLocale, pair } = await params;
  const locale = normalizeLocaleSlug(rawLocale) ?? "en";
  const msg = getMessages(locale);
  const parsed = parseCompareSlug(pair);
  if (!parsed) {
    return {
      title: `${msg.nav.compare} | kkval.com`,
      robots: { index: false, follow: false },
    };
  }
  const { a, b, slug } = canonicalizeComparePair(parsed.rawA, parsed.rawB);
  const [profA, profB] = await Promise.all([
    getFullCompanyProfile(a, { allowOnDemand: true }),
    getFullCompanyProfile(b, { allowOnDemand: true }),
  ]);
  const bothIndexable = Boolean(
    profA?.company.isIndexable && profB?.company.isIndexable,
  );
  const alternates = buildAbsoluteLocaleAlternates(`/compare/${slug}`, locale);

  return {
    title: formatMessage(msg.meta.compareTitle, { tickerA: a, tickerB: b }),
    description: formatMessage(msg.meta.compareDescription, {
      tickerA: a,
      tickerB: b,
    }),
    alternates,
    robots: bothIndexable ? undefined : { index: false, follow: true },
  };
}

export default async function ComparePairPage({ params }: PageProps) {
  const { locale: rawLocale, pair } = await params;
  const locale = normalizeLocaleSlug(rawLocale);
  if (!locale) notFound();

  const msg = getMessages(locale);
  const parsed = parseCompareSlug(pair);
  if (!parsed) notFound();

  const { a, b, slug } = canonicalizeComparePair(parsed.rawA, parsed.rawB);
  if (pair !== slug) {
    permanentRedirect(localizePath(`/compare/${slug}`, locale));
  }

  const [profA, profB] = await Promise.all([
    getFullCompanyProfile(a, { allowOnDemand: true }),
    getFullCompanyProfile(b, { allowOnDemand: true }),
  ]);

  if (!profA || !profB) {
    notFound();
  }

  const sA = profA.snapshot;
  const sB = profB.snapshot;

  const rows: Array<{
    label: string;
    valA: string;
    valB: string;
    winner: "A" | "B" | null;
  }> = [
    {
      label: msg.company.cashRunway,
      valA: sA?.isCashFlowPositive
        ? msg.company.cashFlowPositive
        : sA?.cashRunwayMonths !== null && sA?.cashRunwayMonths !== undefined
          ? `${sA.cashRunwayMonths.toFixed(1)} ${msg.company.monthsSuffix}`
          : "—",
      valB: sB?.isCashFlowPositive
        ? msg.company.cashFlowPositive
        : sB?.cashRunwayMonths !== null && sB?.cashRunwayMonths !== undefined
          ? `${sB.cashRunwayMonths.toFixed(1)} ${msg.company.monthsSuffix}`
          : "—",
      winner:
        sA?.isCashFlowPositive && !sB?.isCashFlowPositive
          ? "A"
          : sB?.isCashFlowPositive && !sA?.isCashFlowPositive
            ? "B"
            : sA?.cashRunwayMonths != null && sB?.cashRunwayMonths != null
              ? sA.cashRunwayMonths > sB.cashRunwayMonths
                ? "A"
                : sB.cashRunwayMonths > sA.cashRunwayMonths
                  ? "B"
                  : null
              : null,
    },
    {
      label: msg.screen.colLiquidity,
      valA: formatCompactCurrency(sA?.totalLiquidityUsd, "USD", locale),
      valB: formatCompactCurrency(sB?.totalLiquidityUsd, "USD", locale),
      winner:
        sA?.totalLiquidityUsd != null && sB?.totalLiquidityUsd != null
          ? sA.totalLiquidityUsd > sB.totalLiquidityUsd
            ? "A"
            : sB.totalLiquidityUsd > sA.totalLiquidityUsd
              ? "B"
              : null
          : null,
    },
    {
      label: msg.company.ttmFreeCashFlow,
      valA: formatCompactCurrency(sA?.fcfTtmUsd, "USD", locale),
      valB: formatCompactCurrency(sB?.fcfTtmUsd, "USD", locale),
      winner:
        sA?.fcfTtmUsd != null && sB?.fcfTtmUsd != null
          ? sA.fcfTtmUsd > sB.fcfTtmUsd
            ? "A"
            : sB.fcfTtmUsd > sA.fcfTtmUsd
              ? "B"
              : null
          : null,
    },
    {
      label: msg.company.shareDilution1y,
      valA: sA?.possibleReverseSplit
        ? msg.company.reverseSplitFlag
        : formatPercent(sA?.shareDilution1yPct),
      valB: sB?.possibleReverseSplit
        ? msg.company.reverseSplitFlag
        : formatPercent(sB?.shareDilution1yPct),
      // Lower dilution is better
      winner:
        !sA?.possibleReverseSplit &&
        !sB?.possibleReverseSplit &&
        sA?.shareDilution1yPct != null &&
        sB?.shareDilution1yPct != null
          ? sA.shareDilution1yPct < sB.shareDilution1yPct
            ? "A"
            : sB.shareDilution1yPct < sA.shareDilution1yPct
              ? "B"
              : null
          : null,
    },
    {
      label: msg.company.debtVsCash,
      valA: sA?.debtToCashRatio != null ? `${sA.debtToCashRatio.toFixed(2)}x` : "—",
      valB: sB?.debtToCashRatio != null ? `${sB.debtToCashRatio.toFixed(2)}x` : "—",
      winner:
        sA?.debtToCashRatio != null && sB?.debtToCashRatio != null
          ? sA.debtToCashRatio < sB.debtToCashRatio
            ? "A"
            : sB.debtToCashRatio < sA.debtToCashRatio
              ? "B"
              : null
          : null,
    },
    {
      label: msg.company.offeringFilings12m,
      valA: String(sA?.offeringFilings12m ?? 0),
      valB: String(sB?.offeringFilings12m ?? 0),
      winner:
        sA && sB
          ? sA.offeringFilings12m < sB.offeringFilings12m
            ? "A"
            : sB.offeringFilings12m < sA.offeringFilings12m
              ? "B"
              : null
          : null,
    },
    {
      label: msg.company.metricRevenue + " (TTM USD)",
      valA: formatCompactCurrency(sA?.revenueTtmUsd, "USD", locale),
      valB: formatCompactCurrency(sB?.revenueTtmUsd, "USD", locale),
      winner:
        sA?.revenueTtmUsd != null && sB?.revenueTtmUsd != null
          ? sA.revenueTtmUsd > sB.revenueTtmUsd
            ? "A"
            : sB.revenueTtmUsd > sA.revenueTtmUsd
              ? "B"
              : null
          : null,
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-5 py-10 sm:px-8 sm:py-12">
      <header className="space-y-2 border-b border-zinc-200 pb-6 dark:border-zinc-800">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-50">
          {formatMessage(msg.compare.heading, {
            tickerA: profA.company.ticker,
            tickerB: profB.company.ticker,
          })}
        </h1>
        <p className="max-w-2xl text-base text-zinc-500 dark:text-zinc-400">
          {msg.compare.subheading}
        </p>
      </header>

      <AdSlot variant="leaderboard" />

      <div className="overflow-x-auto rounded-2xl border border-zinc-200/90 bg-white dark:border-zinc-800 dark:bg-zinc-900/70">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50/70 dark:border-zinc-800 dark:bg-zinc-950/50">
              <th className="px-5 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                {msg.compare.metricCol}
              </th>
              <th className="px-5 py-4 font-bold">
                <div className="flex items-center gap-3">
                  <CompanyBadge ticker={profA.company.ticker} size="md" />
                  <div>
                    <Link
                      href={localizePath(`/stock/${profA.company.ticker}`, locale)}
                      className="font-mono text-emerald-700 hover:underline dark:text-emerald-400"
                    >
                      {profA.company.ticker}
                    </Link>
                    <div className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
                      {cleanCompanyName(profA.company.name) || profA.company.name}
                    </div>
                  </div>
                </div>
              </th>
              <th className="px-5 py-4 font-bold">
                <div className="flex items-center gap-3">
                  <CompanyBadge ticker={profB.company.ticker} size="md" />
                  <div>
                    <Link
                      href={localizePath(`/stock/${profB.company.ticker}`, locale)}
                      className="font-mono text-emerald-700 hover:underline dark:text-emerald-400"
                    >
                      {profB.company.ticker}
                    </Link>
                    <div className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
                      {cleanCompanyName(profB.company.name) || profB.company.name}
                    </div>
                  </div>
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/70">
            {rows.map((r) => (
              <tr key={r.label}>
                <td className="px-5 py-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                  {r.label}
                </td>
                <td
                  className={`tabular-nums px-5 py-4 text-sm font-semibold ${
                    r.winner === "A"
                      ? "text-emerald-700 dark:text-emerald-400"
                      : "text-zinc-800 dark:text-zinc-200"
                  }`}
                >
                  {r.valA}
                </td>
                <td
                  className={`tabular-nums px-5 py-4 text-sm font-semibold ${
                    r.winner === "B"
                      ? "text-emerald-700 dark:text-emerald-400"
                      : "text-zinc-800 dark:text-zinc-200"
                  }`}
                >
                  {r.valB}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
