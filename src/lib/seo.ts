import {
  DEFAULT_LOCALE,
  localizePath,
  SUPPORTED_LOCALES,
} from "@/lib/i18n/locales";

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://kkval.com";

export const COMPANIES_PER_SITEMAP = 2_500;

export function absoluteUrl(pathname: string): string {
  const safePath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${SITE_URL}${safePath}`;
}

export function buildAbsoluteLocaleAlternates(
  pathname: string,
  activeLocale: string = DEFAULT_LOCALE,
): { canonical: string; languages: Record<string, string> } {
  const languages: Record<string, string> = {
    "x-default": absoluteUrl(localizePath(pathname, DEFAULT_LOCALE)),
  };
  for (const loc of SUPPORTED_LOCALES) {
    languages[loc.hreflang] = absoluteUrl(localizePath(pathname, loc.slug));
  }
  return {
    canonical: absoluteUrl(localizePath(pathname, activeLocale)),
    languages,
  };
}

export function canonicalizeComparePair(
  tickerA: string,
  tickerB: string,
): { a: string; b: string; slug: string } {
  const cleanA = tickerA.trim().toUpperCase();
  const cleanB = tickerB.trim().toUpperCase();
  if (cleanA <= cleanB) {
    return { a: cleanA, b: cleanB, slug: `${cleanA}-vs-${cleanB}` };
  }
  return { a: cleanB, b: cleanA, slug: `${cleanB}-vs-${cleanA}` };
}

export function parseCompareSlug(
  pairSlug: string,
): { rawA: string; rawB: string } | null {
  const match = /^([A-Za-z0-9.-]{1,8})-vs-([A-Za-z0-9.-]{1,8})$/i.exec(
    pairSlug.trim(),
  );
  if (!match) return null;
  const rawA = match[1].toUpperCase();
  const rawB = match[2].toUpperCase();
  if (rawA === rawB) return null;
  return { rawA, rawB };
}

export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
