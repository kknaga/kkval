import type { FinancialPeriodRow } from "@/db/schema";
import { formatCompactCurrency, formatCompactNumber } from "@/lib/i18n/locales";
import { buildSecFilingUrl } from "@/lib/sec/client";
import type { Messages } from "@/lib/i18n/messages";

interface ProvenanceTableProps {
  cik: string;
  periods: FinancialPeriodRow[];
  currency: string;
  locale: string;
  msg: Messages["company"];
}

export function ProvenanceTable({
  cik,
  periods,
  currency,
  locale,
  msg,
}: ProvenanceTableProps) {
  const rows = periods.slice(0, 6);
  if (rows.length === 0) return null;

  return (
    <section className="rounded-2xl border border-zinc-200/90 bg-white p-6 sm:p-8 dark:border-zinc-800 dark:bg-zinc-900/70">
      <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
        {msg.provenanceTitle}
      </h2>
      <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
        {msg.provenanceNote}
      </p>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              <th className="py-3 pr-4 font-medium">{msg.colDate}</th>
              <th className="py-3 pr-4 font-medium text-right">{msg.metricRevenue}</th>
              <th className="py-3 pr-4 font-medium text-right">{msg.metricNetIncome}</th>
              <th className="py-3 pr-4 font-medium text-right">{msg.metricCash}</th>
              <th className="py-3 pr-4 font-medium text-right">{msg.metricOcf}</th>
              <th className="py-3 pr-4 font-medium text-right">{msg.metricFcf}</th>
              <th className="py-3 pr-4 font-medium text-right">{msg.metricDebt}</th>
              <th className="py-3 pr-4 font-medium text-right">{msg.metricShares}</th>
              <th className="py-3 font-medium text-right">{msg.colFiling}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/70">
            {rows.map((p) => {
              const primaryProv =
                p.provenanceJson.revenue ??
                p.provenanceJson.operatingCashFlow ??
                p.provenanceJson.netIncome ??
                p.provenanceJson.totalLiquidity;
              const secUrl = primaryProv
                ? buildSecFilingUrl(cik, primaryProv.accn)
                : null;

              return (
                <tr key={`${p.periodType}-${p.periodEnd}`}>
                  <td className="tabular-nums whitespace-nowrap py-4 pr-4 font-medium text-zinc-800 dark:text-zinc-200">
                    {p.periodEnd}
                  </td>
                  <td
                    className="tabular-nums whitespace-nowrap py-4 pr-4 text-right"
                    title={p.provenanceJson.revenue?.tag}
                  >
                    {formatCompactCurrency(p.revenue, currency, locale)}
                  </td>
                  <td
                    className="tabular-nums whitespace-nowrap py-4 pr-4 text-right"
                    title={p.provenanceJson.netIncome?.tag}
                  >
                    {formatCompactCurrency(p.netIncome, currency, locale)}
                  </td>
                  <td
                    className="tabular-nums whitespace-nowrap py-4 pr-4 text-right"
                    title={p.provenanceJson.totalLiquidity?.tag}
                  >
                    {formatCompactCurrency(p.totalLiquidity, currency, locale)}
                  </td>
                  <td
                    className="tabular-nums whitespace-nowrap py-4 pr-4 text-right"
                    title={p.provenanceJson.operatingCashFlow?.tag}
                  >
                    {formatCompactCurrency(p.operatingCashFlow, currency, locale)}
                  </td>
                  <td className="tabular-nums whitespace-nowrap py-4 pr-4 text-right">
                    {formatCompactCurrency(p.freeCashFlow, currency, locale)}
                  </td>
                  <td
                    className="tabular-nums whitespace-nowrap py-4 pr-4 text-right"
                    title={p.provenanceJson.totalDebt?.tag}
                  >
                    {formatCompactCurrency(p.totalDebt, currency, locale)}
                  </td>
                  <td
                    className="tabular-nums whitespace-nowrap py-4 pr-4 text-right"
                    title={p.provenanceJson.sharesOutstanding?.tag}
                  >
                    {formatCompactNumber(p.sharesOutstanding, locale)}
                  </td>
                  <td className="whitespace-nowrap py-4 text-right">
                    {secUrl && primaryProv ? (
                      <a
                        href={secUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-emerald-700 hover:underline dark:text-emerald-400"
                        title={`${primaryProv.taxonomy}:${primaryProv.tag} (${primaryProv.filed})`}
                      >
                        {primaryProv.form}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
