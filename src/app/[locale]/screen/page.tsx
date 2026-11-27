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
    <div className="mx-auto max-w-6xl space-y-10 px-5 py-10 sm:px-8 sm:py-12">
      <header className="space-y-2 border-b border-zinc-200 pb-6 dark:border-zinc-800">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-50">
          {msg.screen.indexTitle}
        </h1>
        <p className="max-w-2xl text-base text-zinc-500 dark:text-zinc-400">
          {msg.screen.indexSub}
        </p>
      </header>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {SCREENER_SLUGS.map((slug) => {
          const card = msg.screen.cards[slug];
          return (
            <Link
              key={slug}
              href={localizePath(`/screen/${slug}`, locale)}
              className="block h-full"
            >
              <article className="group h-full rounded-2xl border border-zinc-200/90 bg-white p-6 transition-all hover:border-emerald-500/70 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/70">
                <h2 className="text-lg font-bold text-zinc-900 group-hover:text-emerald-700 dark:text-zinc-100 dark:group-hover:text-emerald-400">
                  {card.title}
                </h2>
                <p className="mt-2.5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {card.description}
                </p>
              </article>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
