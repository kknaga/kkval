import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import {
  formatCompactCurrency,
  formatCompactNumber,
  getLocaleMeta,
  localizePath,
  normalizeLocaleSlug,
} from "@/lib/i18n/locales";
import { formatMessage, getMessages } from "@/lib/i18n/messages";
import {
  findCompanyByTickerOrAlias,
  getFullCompanyProfile,
} from "@/lib/queries/companies";
import { buildSecFilingUrl } from "@/lib/sec/client";
import {
  absoluteUrl,
  buildAbsoluteLocaleAlternates,
  canonicalizeComparePair,
  serializeJsonLd,
} from "@/lib/seo";
import { AdSlot } from "@/components/AdSlot";
import { ComparePicker } from "@/components/ComparePicker";
import { FinancialCharts } from "@/components/FinancialCharts";
import { HealthCheckCard } from "@/components/HealthCheckCard";
import { ProvenanceTable } from "@/components/ProvenanceTable";

export const revalidate = 3600;

interface PageProps {
  params: Promise<{
    locale: string;
    ticker: string;
  }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale: rawLocale, ticker: rawTicker } = await params;
  const locale = normalizeLocaleSlug(rawLocale) ?? "en";
  const msg = getMessages(locale);
  const company = await findCompanyByTickerOrAlias(rawTicker);

  if (!company) {
    return {
      title: `${rawTicker.toUpperCase()} | kkval.com`,
      robots: { index: false, follow: false },
    };
  }

  const basePath = `/stock/${company.ticker}`;
  const alternates = buildAbsoluteLocaleAlternates(basePath, locale);
  const title = formatMessage(msg.meta.companyTitle, {
    ticker: company.ticker,
    name: company.name,
  });
  const description = formatMessage(msg.meta.companyDescription, {
    ticker: company.ticker,
    name: company.name,
  });

  return {
    title,
    description,
    alternates,
    robots: company.isIndexable ? undefined : { index: false, follow: true },
    openGraph: {
      type: "article",
      siteName: "kkval.com",
      locale: getLocaleMeta(locale).intlCode,
      url: alternates.canonical,
      title,
      description,
    },
  };
}

export default async function StockPage({ params }: PageProps) {
  const { locale: rawLocale, ticker: rawTicker } = await params;
  const locale = normalizeLocaleSlug(rawLocale);
  if (!locale) notFound();

  const msg = getMessages(locale);
  const profile = await getFullCompanyProfile(rawTicker);
  if (!profile) {
    notFound();
  }

  const { company, snapshot, annual, quarterly, insiders, institutions, filings, peers } =
    profile;

  // Redirect lowercase or secondary warrant tickers to canonical uppercase URL
  if (rawTicker !== company.ticker) {
    permanentRedirect(localizePath(`/stock/${company.ticker}`, locale));
  }

  const currency = company.reportingCurrency || "USD";
  const openMarketInsiders = insiders.filter((tx) => tx.isOpenMarket);
  const shownInsiders =
    openMarketInsiders.length > 0 ? openMarketInsiders : insiders.slice(0, 15);

  const runwayFaqAnswer =
    company.entityClass === "spac" || company.entityClass === "financial"
      ? msg.company.notApplicableSector
      : snapshot?.isCashFlowPositive
        ? `${company.name} (${company.ticker}) ${msg.company.cashFlowPositive}.`
        : snapshot?.cashRunwayMonths !== null && snapshot?.cashRunwayMonths !== undefined
          ? `${snapshot.cashRunwayMonths.toFixed(1)} ${msg.company.monthsSuffix} (${formatCompactCurrency(snapshot.totalLiquidityNative ?? snapshot.totalLiquidityUsd, currency, locale)}).`
          : "—";

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Corporation",
      name: company.name,
      tickerSymbol: company.ticker,
      url: absoluteUrl(localizePath(`/stock/${company.ticker}`, locale)),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "kkval.com",
          item: absoluteUrl(localizePath("/", locale)),
        },
        {
          "@type": "ListItem",
          position: 2,
          name: company.ticker,
          item: absoluteUrl(localizePath(`/stock/${company.ticker}`, locale)),
        },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: `${company.ticker} ${msg.company.cashRunway}?`,
          acceptedAnswer: {
            "@type": "Answer",
            text: runwayFaqAnswer,
          },
        },
      ],
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />

      {/* Company Header */}
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-200 pb-5 dark:border-zinc-800">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl dark:text-zinc-50">
              <span className="font-mono text-emerald-700 dark:text-emerald-400">
                {company.ticker}
              </span>{" "}
              — {company.name}
            </h1>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            {company.exchange && (
              <span className="rounded-md border border-zinc-200 bg-white px-2 py-0.5 font-medium dark:border-zinc-800 dark:bg-zinc-900">
                {company.exchange}
              </span>
            )}
            <span className="rounded-md border border-zinc-200 bg-white px-2 py-0.5 font-mono dark:border-zinc-800 dark:bg-zinc-900">
              CIK {company.cik}
            </span>
            <span className="rounded-md border border-zinc-200 bg-white px-2 py-0.5 font-medium dark:border-zinc-800 dark:bg-zinc-900">
              {currency}
            </span>
            {company.lastFilingDate && (
              <span>Last SEC filing: {company.lastFilingDate}</span>
            )}
          </div>
        </div>

        <ComparePicker
          baseTicker={company.ticker}
          locale={locale}
          label={msg.company.compareWith}
          placeholder={msg.company.comparePlaceholder}
          buttonLabel={msg.company.compareGo}
        />
      </header>

      {/* Health Check Above the Fold */}
      {snapshot && (
        <HealthCheckCard
          company={company}
          snapshot={snapshot}
          locale={locale}
        />
      )}

      <AdSlot variant="leaderboard" />

      {/* Charts */}
      <FinancialCharts
        annual={annual}
        quarterly={quarterly}
        currency={currency}
        locale={locale}
        labels={{
          title: msg.company.chartsTitle,
          annual: msg.company.annual,
          quarterly: msg.company.quarterly,
          revenueAndIncome: msg.company.revenueAndIncome,
          cashVsDebt: msg.company.cashVsDebt,
          cashFlowAndFcf: msg.company.cashFlowAndFcf,
          shareCountTrend: msg.company.shareCountTrend,
          revenue: msg.company.metricRevenue,
          netIncome: msg.company.metricNetIncome,
          cash: msg.company.metricCash,
          debt: msg.company.metricDebt,
          ocf: msg.company.metricOcf,
          fcf: msg.company.metricFcf,
          shares: msg.company.metricShares,
        }}
      />

      <AdSlot variant="in-article" />

      {/* Insiders & Institutional Funds */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/70">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              {msg.company.insidersTitle}
            </h2>
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
              {openMarketInsiders.length > 0
                ? msg.company.openMarketOnly
                : msg.company.includeAllTx}
            </span>
          </div>

          {shownInsiders.length === 0 ? (
            <p className="mt-5 text-xs text-zinc-400">{msg.company.noInsiders}</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                    <th className="py-2 pr-2 font-medium">{msg.company.colDate}</th>
                    <th className="py-2 pr-2 font-medium">{msg.company.colInsider}</th>
                    <th className="py-2 pr-2 font-medium">{msg.company.colType}</th>
                    <th className="py-2 pr-2 font-medium text-right">{msg.company.colShares}</th>
                    <th className="py-2 pr-2 font-medium text-right">{msg.company.colValue}</th>
                    <th className="py-2 font-medium text-right">{msg.company.colFiling}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/70">
                  {shownInsiders.slice(0, 15).map((tx) => {
                    const isBuy = tx.transactionCode === "P";
                    const isSell = tx.transactionCode === "S";
                    const badgeLabel = isBuy
                      ? msg.company.insiderBuy
                      : isSell
                        ? msg.company.insiderSell
                        : `${msg.company.insiderOther} (${tx.transactionCode})`;
                    const badgeClass = isBuy
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                      : isSell
                        ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                        : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";

                    return (
                      <tr key={tx.id}>
                        <td className="tabular-nums whitespace-nowrap py-2 pr-2 text-zinc-600 dark:text-zinc-400">
                          {tx.transactionDate || tx.filingDate}
                        </td>
                        <td className="max-w-[150px] truncate py-2 pr-2">
                          <div className="truncate font-medium text-zinc-800 dark:text-zinc-200">
                            {tx.ownerName}
                          </div>
                          {tx.ownerTitle && (
                            <div className="truncate text-[10px] text-zinc-400">
                              {tx.ownerTitle}
                            </div>
                          )}
                        </td>
                        <td className="whitespace-nowrap py-2 pr-2">
                          <span
                            className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${badgeClass}`}
                          >
                            {badgeLabel}
                          </span>
                        </td>
                        <td className="tabular-nums whitespace-nowrap py-2 pr-2 text-right">
                          {formatCompactNumber(tx.shares, locale)}
                        </td>
                        <td className="tabular-nums whitespace-nowrap py-2 pr-2 text-right">
                          {formatCompactCurrency(tx.totalValueUsd, "USD", locale)}
                        </td>
                        <td className="whitespace-nowrap py-2 text-right">
                          <a
                            href={buildSecFilingUrl(
                              company.cik,
                              tx.accn,
                              tx.primaryDocument,
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-700 hover:underline dark:text-emerald-400"
                          >
                            4
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/70">
          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
            {msg.company.fundsTitle}
          </h2>

          {institutions.length === 0 ? (
            <p className="mt-5 text-xs text-zinc-400">{msg.company.noFunds}</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                    <th className="py-2 pr-2 font-medium">{msg.company.colManager}</th>
                    <th className="py-2 pr-2 font-medium text-right">{msg.company.colShares}</th>
                    <th className="py-2 pr-2 font-medium text-right">
                      {msg.company.colPositionValue}
                    </th>
                    <th className="py-2 font-medium text-right">{msg.company.colQuarter}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/70">
                  {institutions.slice(0, 15).map((h) => (
                    <tr key={h.id}>
                      <td className="max-w-[200px] truncate py-2 pr-2 font-medium text-zinc-800 dark:text-zinc-200">
                        {h.managerName}
                        {h.putCall ? ` (${h.putCall})` : ""}
                      </td>
                      <td className="tabular-nums whitespace-nowrap py-2 pr-2 text-right">
                        {formatCompactNumber(h.shares, locale)}
                      </td>
                      <td className="tabular-nums whitespace-nowrap py-2 pr-2 text-right">
                        {formatCompactCurrency(h.valueUsd, "USD", locale)}
                      </td>
                      <td className="tabular-nums whitespace-nowrap py-2 text-right text-zinc-500 dark:text-zinc-400">
                        {h.quarterEnd}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* Provenance Table */}
      <ProvenanceTable
        cik={company.cik}
        periods={annual.length > 0 ? annual : quarterly}
        currency={currency}
        locale={locale}
        msg={msg.company}
      />

      {/* Recent SEC Filings & Dilution Alerts */}
      {filings.length > 0 && (
        <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/70">
          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
            {msg.company.filingsTitle}
          </h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {filings.slice(0, 12).map((f) => (
              <a
                key={f.accn}
                href={buildSecFilingUrl(company.cik, f.accn, f.primaryDocument)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200/80 px-3 py-2 text-xs transition-colors hover:border-emerald-500 dark:border-zinc-800"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
                    {f.form}
                  </span>
                  {f.isDilutionFiling && (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                      {msg.company.dilutionBadge}
                    </span>
                  )}
                </div>
                <span className="tabular-nums text-zinc-500 dark:text-zinc-400">
                  {f.filingDate}
                </span>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Peer Comparisons */}
      {peers.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
            {msg.company.peerCompareTitle}
          </h2>
          <div className="flex flex-wrap gap-2.5">
            {peers.map((p) => {
              const { slug } = canonicalizeComparePair(company.ticker, p.ticker);
              return (
                <Link
                  key={p.ticker}
                  href={localizePath(`/compare/${slug}`, locale)}
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 transition-colors hover:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
                >
                  <span className="font-mono text-emerald-700 dark:text-emerald-400">
                    {company.ticker} vs {p.ticker}
                  </span>
                  <span className="ml-2 font-normal text-zinc-500 dark:text-zinc-400">
                    {p.name}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
