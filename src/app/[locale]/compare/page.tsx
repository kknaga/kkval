import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { localizePath, normalizeLocaleSlug } from "@/lib/i18n/locales";
import { getMessages } from "@/lib/i18n/messages";
import { buildAbsoluteLocaleAlternates } from "@/lib/seo";

const POPULAR_PAIRS = [
  ["AAPL", "MSFT"],
  ["AMD", "NVDA"],
  ["IONQ", "RGTI"],
  ["LCID", "RIVN"],
  ["MARA", "RIOT"],
  ["BABA", "NIO"],
  ["AMZN", "META"],
  ["DNA", "PLUG"],
];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocaleSlug(rawLocale) ?? "en";
  const msg = getMessages(locale);
  return {
    title: `${msg.nav.compare} | kkval.com`,
    description: msg.compare.tryPair,
    alternates: buildAbsoluteLocaleAlternates("/compare", locale),
  };
}

export default async function CompareIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocaleSlug(rawLocale);
  if (!locale) notFound();
  const msg = getMessages(locale);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        {msg.home.compareHeading}
      </h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {msg.compare.tryPair}
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {POPULAR_PAIRS.map(([a, b]) => {
          const [first, second] = a <= b ? [a, b] : [b, a];
          return (
            <Link
              key={`${first}-${second}`}
              href={localizePath(`/compare/${first}-vs-${second}`, locale)}
              className="rounded-xl border border-zinc-200 bg-white p-4 font-mono text-sm font-bold text-zinc-900 transition-colors hover:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-100"
            >
              {first} vs {second}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
