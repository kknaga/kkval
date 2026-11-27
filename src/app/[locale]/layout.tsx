import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getLocaleMeta,
  localizePath,
  normalizeLocaleSlug,
} from "@/lib/i18n/locales";
import { getMessages } from "@/lib/i18n/messages";
import { buildAbsoluteLocaleAlternates, KKSTAKE_URL } from "@/lib/seo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TickerSearch } from "@/components/TickerSearch";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocaleSlug(rawLocale) ?? "en";
  const messages = getMessages(locale);
  const alternates = buildAbsoluteLocaleAlternates("/", locale);

  return {
    title: messages.meta.siteTitle,
    description: messages.meta.siteDescription,
    alternates,
    openGraph: {
      type: "website",
      siteName: "kkval.com",
      locale: getLocaleMeta(locale).intlCode,
      title: messages.meta.siteTitle,
      description: messages.meta.siteDescription,
      url: alternates.canonical,
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocaleSlug(rawLocale);
  if (!locale) {
    notFound();
  }

  const messages = getMessages(locale);

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-zinc-200/80 bg-white/95 backdrop-blur-sm dark:border-zinc-800/80 dark:bg-zinc-950/95">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
          <div className="flex items-center gap-6">
            <Link
              href={localizePath("/", locale)}
              className="inline-flex shrink-0 items-center gap-2 text-zinc-900 transition-opacity hover:opacity-85 dark:text-zinc-100"
            >
              <Image
                src="/logo.svg"
                alt="kkval.com"
                width={28}
                height={28}
                unoptimized
                priority
                className="h-7 w-7 shrink-0"
              />
              <span className="font-brand text-[19px] font-bold tracking-[-0.04em]">
                kkval
                <span className="text-emerald-600 dark:text-emerald-400">
                  .com
                </span>
              </span>
            </Link>

            <nav className="hidden items-center gap-6 text-sm font-medium text-zinc-600 md:flex dark:text-zinc-300">
              <Link
                href={localizePath("/screen", locale)}
                className="hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                {messages.nav.screeners}
              </Link>
              <Link
                href={localizePath("/compare", locale)}
                className="hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                {messages.nav.compare}
              </Link>
              <Link
                href={localizePath("/methodology", locale)}
                className="hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                {messages.nav.methodology}
              </Link>
            </nav>
          </div>

          <div className="hidden max-w-xs flex-1 sm:block">
            <TickerSearch
              locale={locale}
              placeholder={messages.nav.searchPlaceholder}
              buttonLabel={messages.nav.searchButton}
              compact
            />
          </div>

          <div className="flex items-center gap-2">
            <LanguageSwitcher
              currentLocale={locale}
              label={messages.nav.languageLabel}
            />
            <ThemeToggle
              switchToDarkLabel={messages.nav.switchToDark}
              switchToLightLabel={messages.nav.switchToLight}
            />
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto max-w-6xl space-y-4 px-5 py-10 sm:px-8">
          <nav
            aria-label="Footer"
            className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-medium text-zinc-600 dark:text-zinc-300"
          >
            <Link
              href={localizePath("/screen", locale)}
              className="hover:text-zinc-900 hover:underline underline-offset-4 dark:hover:text-zinc-100"
            >
              {messages.nav.screeners}
            </Link>
            <Link
              href={localizePath("/compare", locale)}
              className="hover:text-zinc-900 hover:underline underline-offset-4 dark:hover:text-zinc-100"
            >
              {messages.nav.compare}
            </Link>
            <Link
              href={localizePath("/methodology", locale)}
              className="hover:text-zinc-900 hover:underline underline-offset-4 dark:hover:text-zinc-100"
            >
              {messages.footer.methodology}
            </Link>
            <a
              href={KKSTAKE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-zinc-900 hover:underline underline-offset-4 dark:hover:text-zinc-100"
            >
              kkstake.com
            </a>
            <Link
              href="/privacy"
              className="hover:text-zinc-900 hover:underline underline-offset-4 dark:hover:text-zinc-100"
            >
              {messages.footer.privacy}
            </Link>
            <Link
              href="/terms"
              className="hover:text-zinc-900 hover:underline underline-offset-4 dark:hover:text-zinc-100"
            >
              {messages.footer.terms}
            </Link>
          </nav>
          <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            {messages.footer.disclaimer}
          </p>
        </div>
      </footer>
    </>
  );
}
