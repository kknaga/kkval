import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { normalizeLocaleSlug } from "@/lib/i18n/locales";
import { getMessages } from "@/lib/i18n/messages";
import { buildAbsoluteLocaleAlternates } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocaleSlug(rawLocale) ?? "en";
  const msg = getMessages(locale);

  return {
    title: msg.meta.methodologyTitle,
    alternates: buildAbsoluteLocaleAlternates("/methodology", locale),
  };
}

export default async function MethodologyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocaleSlug(rawLocale);
  if (!locale) notFound();
  const msg = getMessages(locale);

  return (
    <article className="mx-auto max-w-3xl space-y-6 px-4 py-10 text-sm leading-relaxed text-zinc-700 sm:px-6 dark:text-zinc-300">
      <h1 className="text-2xl font-bold text-zinc-900 sm:text-3xl dark:text-zinc-50">
        {msg.nav.methodology}
      </h1>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
          1. SEC EDGAR Data Sources
        </h2>
        <p>
          All company financials, insider transactions, and fund holdings on
          kkval.com are ingested automatically from public U.S. SEC EDGAR bulk
          datasets and XML filings: <code>companyfacts.zip</code>,{" "}
          <code>submissions.zip</code>, <code>company_tickers_exchange.json</code>,
          daily Form 4 XML filings, and quarterly Form 13F DERA data sets.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
          2. XBRL Normalization & YTD Cash-Flow De-cumulation
        </h2>
        <p>
          SEC XBRL facts frequently repeat historical periods across
          comparative columns in later 10-K/10-Q filings. We deduplicate every
          period by exact <code>(start, end)</code> span (or instant{" "}
          <code>end</code> date), keeping the most recently filed value so
          amendments and restatements win automatically. Cash flow statements are
          reported year-to-date (3M, 6M, 9M, 12M), so standalone quarters are
          computed as <code>Q2 = 6M - Q1</code>, <code>Q3 = 9M - 6M</code>, and{" "}
          <code>Q4 = FY - 9M</code>.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
          3. Health Check Formulas
        </h2>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong>Total Liquidity:</strong> Cash &amp; Cash Equivalents plus
            Current Marketable Securities / Short-Term Investments.
          </li>
          <li>
            <strong>Cash Runway (Months):</strong>{" "}
            <code>Total Liquidity / (|TTM Operating Cash Flow| / 12)</code> when
            trailing-12-month operating cash flow is negative. Companies with
            positive TTM operating cash flow are marked cash-flow positive.
          </li>
          <li>
            <strong>Free Cash Flow:</strong> Operating Cash Flow minus Capital
            Expenditures (<code>PaymentsToAcquirePropertyPlantAndEquipment</code>).
          </li>
          <li>
            <strong>Share Dilution &amp; Reverse-Split Guard:</strong>{" "}
            Year-over-year percentage change in reported common shares
            outstanding, paired with a 12-month count of shelf/offering filings
            (<code>S-3</code>, <code>424B5</code>, <code>424B3</code>,{" "}
            <code>S-1</code>). Sudden single-period drops of 40% or more are
            flagged as potential reverse stock splits.
          </li>
          <li>
            <strong>Sector Exclusions:</strong> SPACs (SIC 6770) and banks /
            financial institutions (SIC 6000–6499) are excluded from cash-runway
            and debt-to-cash alerts because their balance sheets follow
            different structures.
          </li>
        </ul>
      </section>
    </article>
  );
}
