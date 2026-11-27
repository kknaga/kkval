import Link from "next/link";
import { notFound } from "next/navigation";
import { cleanCompanyName, formatTradeImpact } from "@/lib/format-stake-pct";
import {
  formatCompactCurrency,
  formatPercent,
  localizePath,
  normalizeLocaleSlug,
} from "@/lib/i18n/locales";
import { getMessages } from "@/lib/i18n/messages";
import { getHomePageData, SCREENER_SLUGS } from "@/lib/queries/companies";
import { absoluteUrl, serializeJsonLd } from "@/lib/seo";
import { AdSlot } from "@/components/AdSlot";
import { TickerSearch } from "@/components/TickerSearch";

export const dynamic = "force-dynamic";

const DEFAULT_COMPARE_PAIRS = [
  ["AAPL", "MSFT"],
  ["NVDA", "AMD"],
  ["IONQ", "RGTI"],
  ["LCID", "RIVN"],
  ["MARA", "RIOT"],
  ["NVO", "LLY"],
];

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocaleSlug(rawLocale);
  if (!locale) notFound();

  const msg = getMessages(locale);
  const data = await getHomePageData();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "kkval.com",
    url: absoluteUrl(localizePath("/", locale)),
    potentialAction: {
      "@type": "SearchAction",
      target: `${absoluteUrl("/stock/{search_term_string}")}`,
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <div className="mx-auto max-w-6xl space-y-16 px-5 py-12 sm:px-8 sm:py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />

      {/* Airy Hero Search */}
      <section className="mx-auto max-w-3xl py-4 text-center">
        <div className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1 text-xs font-medium text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/60 dark:text-emerald-300">
          {msg.home.eyebrow}
        </div>

        <h1 className="mt-6 text-3xl font-bold tracking-tight text-zinc-900 sm:text-5xl dark:text-zinc-50">
          {msg.home.headline}
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-zinc-500 dark:text-zinc-400">
          {msg.home.subhead}
        </p>

        <div className="mx-auto mt-8 max-w-xl">
          <TickerSearch
            locale={locale}
            placeholder={msg.nav.searchPlaceholder}
            buttonLabel={msg.nav.searchButton}
          />
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
          {data.totalIndexed > 0 && (
            <span className="rounded-full bg-zinc-100 px-3.5 py-1.5 text-xs font-medium text-zinc-600 tabular-nums dark:bg-zinc-900 dark:text-zinc-300">
              {data.totalIndexed.toLocaleString()} {msg.home.companiesIndexed}
            </span>
          )}
          {data.popularTickers.slice(0, 8).map((t) => (
            <Link
              key={t.ticker}
              href={localizePath(`/stock/${t.ticker}`, locale)}
              className="rounded-xl border border-zinc-200 bg-white px-3.5 py-1.5 font-mono text-xs font-semibold text-zinc-700 transition-colors hover:border-emerald-500 hover:text-emerald-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:text-emerald-400"
            >
              {t.ticker}
            </Link>
          ))}
        </div>
      </section>

      <AdSlot variant="leaderboard" />

      {/* Screeners */}
      <section className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-bold text-zinc-900 sm:text-2xl dark:text-zinc-100">
            {msg.home.screenersHeading}
          </h2>
          <Link
            href={localizePath("/screen", locale)}
            className="text-sm font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
          >
            {msg.home.viewAllScreeners} →
          </Link>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {SCREENER_SLUGS.map((slug) => {
            const card = msg.screen.cards[slug];
            return (
              <Link
                key={slug}
                href={localizePath(`/screen/${slug}`, locale)}
                className="block h-full"
              >
                <article className="group h-full rounded-2xl border border-zinc-200/90 bg-white p-6 transition-all hover:border-emerald-500/70 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/70 dark:hover:border-emerald-500/60">
                  <h3 className="text-base font-bold text-zinc-900 group-hover:text-emerald-700 dark:text-zinc-100 dark:group-hover:text-emerald-400">
                    {card.title}
                  </h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                    {card.description}
                  </p>
                </article>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Two-Column Watchlist + Insider Buys */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-zinc-200/90 bg-white p-6 sm:p-8 dark:border-zinc-800 dark:bg-zinc-900/70">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
            {msg.home.watchlistHeading}
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {msg.home.watchlistSub}
          </p>

          {data.lowRunwayList.length === 0 ? (
            <p className="mt-6 text-sm text-zinc-400">{msg.screen.empty}</p>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                    <th className="py-3 pr-4 font-medium">{msg.screen.colTicker}</th>
                    <th className="py-3 pr-4 font-medium">{msg.screen.colCompany}</th>
                    <th className="py-3 pr-4 text-right font-medium">{msg.screen.colRunway}</th>
                    <th className="py-3 text-right font-medium">{msg.screen.colDilution1y}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/70">
                  {data.lowRunwayList.map(({ company, snapshot }) => (
                    <tr key={company.cik}>
                      <td className="py-3.5 pr-4 font-mono font-bold">
                        <Link
                          href={localizePath(`/stock/${company.ticker}`, locale)}
                          className="text-emerald-700 hover:underline dark:text-emerald-400"
                        >
                          {company.ticker}
                        </Link>
                      </td>
                      <td className="max-w-[200px] truncate py-3.5 pr-4 text-zinc-700 dark:text-zinc-300">
                        {cleanCompanyName(company.name) || company.name}
                      </td>
                      <td className="tabular-nums py-3.5 pr-4 text-right font-semibold text-rose-600 dark:text-rose-400">
                        {snapshot.cashRunwayMonths?.toFixed(1)}{" "}
                        {msg.company.monthsSuffix}
                      </td>
                      <td className="tabular-nums py-3.5 text-right text-zinc-600 dark:text-zinc-400">
                        {formatPercent(snapshot.shareDilution1yPct)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-zinc-200/90 bg-white p-6 sm:p-8 dark:border-zinc-800 dark:bg-zinc-900/70">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
            {msg.home.insidersHeading}
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {msg.home.insidersSub}
          </p>

          {data.recentBuys.length === 0 ? (
            <p className="mt-6 text-sm text-zinc-400">{msg.company.noInsiders}</p>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                    <th className="py-3 pr-4 font-medium">{msg.screen.colTicker}</th>
                    <th className="py-3 pr-4 font-medium">{msg.company.colInsider}</th>
                    <th className="py-3 pr-4 text-right font-medium">{msg.company.colValue}</th>
                    <th className="py-3 text-right font-medium">{msg.company.colDate}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/70">
                  {data.recentBuys.map((b, idx) => {
                    const impact = formatTradeImpact({
                      action: "P",
                      shares: b.shares,
                      sharesAfter: b.sharesAfter,
                    });
                    return (
                      <tr key={`${b.ticker}-${b.filingDate}-${idx}`}>
                        <td className="py-3.5 pr-4 font-mono font-bold">
                          <Link
                            href={localizePath(`/stock/${b.ticker}`, locale)}
                            className="text-emerald-700 hover:underline dark:text-emerald-400"
                          >
                            {b.ticker}
                          </Link>
                        </td>
                        <td className="max-w-[180px] truncate py-3.5 pr-4 text-zinc-700 dark:text-zinc-300">
                          {b.ownerName}
                        </td>
                        <td className="tabular-nums py-3.5 pr-4 text-right">
                          {impact ? (
                            <>
                              <div className="font-bold text-emerald-700 dark:text-emerald-400">
                                {impact}
                              </div>
                              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                                {formatCompactCurrency(b.totalValueUsd, "USD", locale)}
                              </div>
                            </>
                          ) : (
                            <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                              {formatCompactCurrency(b.totalValueUsd, "USD", locale)}
                            </span>
                          )}
                        </td>
                        <td className="tabular-nums py-3.5 text-right text-zinc-500 dark:text-zinc-400">
                          {b.filingDate}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* Popular Comparisons */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
          {msg.home.compareHeading}
        </h2>
        <div className="flex flex-wrap gap-3">
          {DEFAULT_COMPARE_PAIRS.map(([a, b]) => {
            const [first, second] = a <= b ? [a, b] : [b, a];
            return (
              <Link
                key={`${first}-${second}`}
                href={localizePath(`/compare/${first}-vs-${second}`, locale)}
                className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 font-mono text-sm font-semibold text-zinc-800 transition-colors hover:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
              >
                {first} vs {second}
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
