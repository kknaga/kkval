import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | kkval.com",
};

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-4 px-4 py-10 text-sm leading-relaxed text-zinc-700 sm:px-6 dark:text-zinc-300">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        Terms of Service
      </h1>
      <p>
        All information on kkval.com is generated automatically from public
        U.S. Securities and Exchange Commission (SEC) EDGAR filings and is
        provided strictly for informational and educational purposes.
      </p>
      <p>
        Nothing on kkval.com constitutes investment, tax, or legal advice.
        Derived metrics may contain XBRL tagging edge cases or reporting lags;
        always verify figures against the linked official SEC filings before
        making financial decisions.
      </p>
    </article>
  );
}
