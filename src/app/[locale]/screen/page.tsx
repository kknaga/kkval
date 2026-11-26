import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { localizePath, normalizeLocaleSlug } from "@/lib/i18n/locales";
import { getMessages } from "@/lib/i18n/messages";
import { SCREENER_SLUGS } from "@/lib/queries/companies";
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
    title: msg.meta.screenIndexTitle,
    description: msg.meta.screenIndexDescription,
    alternates: buildAbsoluteLocaleAlternates("/screen", locale),
  };
}

export default async function ScreenIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocaleSlug(rawLocale);
  if (!locale) notFound();

  const msg = getMessages(locale);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-10 sm:px-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-zinc-900 sm:text-3xl dark:text-zinc-50">
          {msg.screen.indexTitle}
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {msg.screen.indexSub}
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SCREENER_SLUGS.map((slug) => {
          const card = msg.screen.cards[slug];
          return (
            <Link
              key={slug}
              href={localizePath(`/screen/${slug}`, locale)}
              className="rounded-xl border border-zinc-200 bg-white p-5 transition-colors hover:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-900/70"
            >
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                {card.title}
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                {card.description}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
