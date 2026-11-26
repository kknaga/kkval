import Link from "next/link";
import { TickerSearch } from "@/components/TickerSearch";

export default function NotFoundPage() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-20 text-center sm:px-6">
      <div className="rounded-full border border-zinc-200 bg-white px-3 py-1 font-mono text-xs font-bold text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
        404
      </div>
      <h1 className="mt-4 text-2xl font-bold text-zinc-900 sm:text-3xl dark:text-zinc-50">
        Ticker or page not found
      </h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        That symbol is not listed in SEC EDGAR or the page does not exist.
        Search for a US-listed ticker below.
      </p>

      <div className="mt-6 w-full">
        <TickerSearch
          locale="en"
          placeholder="Search ticker or company (e.g. RGTI, AAPL)..."
          buttonLabel="Check"
        />
      </div>

      <Link
        href="/"
        className="mt-6 text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
      >
        ← Back to kkval.com
      </Link>
    </div>
  );
}
