import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  formatCompactCurrency,
  formatPercent,
  localizePath,
  normalizeLocaleSlug,
} from "@/lib/i18n/locales";
import { formatMessage, getMessages } from "@/lib/i18n/messages";
import {
  getScreenerResults,
  SCREENER_SLUGS,
  type ScreenerSlug,
} from "@/lib/queries/companies";
import { buildAbsoluteLocaleAlternates } from "@/lib/seo";
import { AdSlot } from "@/components/AdSlot";

export const revalidate = 3600;

interface PageProps {
  params: Promise<{
    locale: string;
    slug: string;
  }>;
}

function isScreenerSlug(val: string): val is ScreenerSlug {
  return (SCREENER_SLUGS as readonly string[]).includes(val);
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params;
  const locale = normalizeLocaleSlug(rawLocale) ?? "en";
  if (!isScreenerSlug(slug)) return {};

  const msg = getMessages(locale);
  const card = msg.screen.cards[slug];
  return {
    title: `${card.title} | kkval.com`,
    description: card.description,
    alternates: buildAbsoluteLocaleAlternates(`/screen/${slug}`, locale),
  };
}

export default async function ScreenerPage({ params }: PageProps) {
  const { locale: rawLocale, slug } = await params;
  const locale = normalizeLocaleSlug(rawLocale);
  if (!locale || !isScreenerSlug(slug)) notFound();

  const msg = getMessages(locale);
  const card = msg.screen.cards[slug];
  const rows = await getScreenerResults(slug, 100);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <header className="space-y-2 border-b border-zinc-200 pb-5 dark:border-zinc-800">
        <div className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
          {formatMessage(msg.screen.companiesCount, { count: rows.length })}
        </div>
        <h1 className="text-2xl font-bold text-zinc-900 sm:text-3xl dark:text-zinc-50">
          {card.title}
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {card.description}
        </p>
      </header>

      <AdSlot variant="leaderboard" />

      {rows.length === 0 ? (
        <p className="rounded-xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/70">
          {msg.screen.empty}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/70">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/70 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-400">
                <th className="px-4 py-3 font-medium">{msg.screen.colTicker}</th>
                <th className="px-4 py-3 font-medium">{msg.screen.colCompany}</th>
                <th className="px-4 py-3 font-medium text-right">{msg.screen.colRunway}</th>
                <th className="px-4 py-3 font-medium text-right">{msg.screen.colDilution1y}</th>
                <th className="px-4 py-3 font-medium text-right">{msg.screen.colLiquidity}</th>
                <th className="px-4 py-3 font-medium text-right">{msg.screen.colFcfTtm}</th>
                <th className="px-4 py-3 font-medium text-right">{msg.screen.colVerdict}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/70">
              {rows.map(({ company, snapshot }) => (
                <tr
                  key={company.cik}
                  className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30"
                >
                  <td className="px-4 py-2.5 font-mono font-bold">
                    <Link
                      href={localizePath(`/stock/${company.ticker}`, locale)}
                      className="text-emerald-700 hover:underline dark:text-emerald-400"
                    >
                      {company.ticker}
                    </Link>
                  </td>
                  <td className="max-w-[240px] truncate px-4 py-2.5 text-zinc-800 dark:text-zinc-200">
                    {company.name}
                  </td>
                  <td className="tabular-nums whitespace-nowrap px-4 py-2.5 text-right">
                    {snapshot.isCashFlowPositive
                      ? msg.company.cashFlowPositive
                      : snapshot.cashRunwayMonths !== null
                        ? `${snapshot.cashRunwayMonths.toFixed(1)} ${msg.company.monthsSuffix}`
                        : "—"}
                  </td>
                  <td className="tabular-nums whitespace-nowrap px-4 py-2.5 text-right">
                    {snapshot.possibleReverseSplit
                      ? "Split?"
                      : formatPercent(snapshot.shareDilution1yPct)}
                  </td>
                  <td className="tabular-nums whitespace-nowrap px-4 py-2.5 text-right">
                    {formatCompactCurrency(
                      snapshot.totalLiquidityUsd,
                      "USD",
                      locale,
                    )}
                  </td>
                  <td className="tabular-nums whitespace-nowrap px-4 py-2.5 text-right">
                    {formatCompactCurrency(snapshot.fcfTtmUsd, "USD", locale)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold">
                    {msg.verdict[snapshot.verdict]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
