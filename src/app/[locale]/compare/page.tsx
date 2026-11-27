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
    <div className="mx-auto max-w-6xl space-y-10 px-5 py-10 sm:px-8 sm:py-12">
      <header className="space-y-2 border-b border-zinc-200 pb-6 dark:border-zinc-800">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-50">
          {msg.home.compareHeading}
        </h1>
        <p className="max-w-2xl text-base text-zinc-500 dark:text-zinc-400">
          {msg.compare.tryPair}
        </p>
      </header>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {POPULAR_PAIRS.map(([a, b]) => {
          const [first, second] = a <= b ? [a, b] : [b, a];
          return (
            <Link
              key={`${first}-${second}`}
              href={localizePath(`/compare/${first}-vs-${second}`, locale)}
              className="block h-full"
            >
              <article className="rounded-2xl border border-zinc-200/90 bg-white p-6 font-mono text-base font-bold text-zinc-900 transition-all hover:border-emerald-500/70 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-100">
                {first} vs {second}
              </article>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
