export interface LocaleMeta {
  slug: string;
  hreflang: string;
  intlCode: string;
  nativeLabel: string;
}

export const DEFAULT_LOCALE = "en" as const;

export const SUPPORTED_LOCALES: readonly LocaleMeta[] = [
  { slug: "en", hreflang: "en", intlCode: "en-US", nativeLabel: "English" },
  { slug: "es", hreflang: "es", intlCode: "es-MX", nativeLabel: "Español" },
  { slug: "ko", hreflang: "ko", intlCode: "ko-KR", nativeLabel: "한국어" },
  { slug: "pt", hreflang: "pt", intlCode: "pt-BR", nativeLabel: "Português" },
  { slug: "ja", hreflang: "ja", intlCode: "ja-JP", nativeLabel: "日本語" },
  { slug: "zh-tw", hreflang: "zh-TW", intlCode: "zh-TW", nativeLabel: "繁體中文" },
  { slug: "de", hreflang: "de", intlCode: "de-DE", nativeLabel: "Deutsch" },
] as const;

const BY_SLUG = new Map<string, LocaleMeta>(
  SUPPORTED_LOCALES.map((loc) => [loc.slug, loc]),
);

export function normalizeLocaleSlug(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const normalized = raw.trim().toLowerCase().replace(/_/g, "-");
  return BY_SLUG.has(normalized) ? normalized : null;
}

export function getLocaleMeta(slug: string | null | undefined): LocaleMeta {
  const normalized = normalizeLocaleSlug(slug) ?? DEFAULT_LOCALE;
  return BY_SLUG.get(normalized)!;
}

export function stripLocalePrefix(pathname: string): {
  locale: string;
  pathnameWithoutLocale: string;
} {
  const safePath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const segments = safePath.split("/");
  const candidate = normalizeLocaleSlug(segments[1]);
  if (!candidate) {
    return {
      locale: DEFAULT_LOCALE,
      pathnameWithoutLocale: safePath,
    };
  }
  const rest = `/${segments.slice(2).join("/")}`;
  return {
    locale: candidate,
    pathnameWithoutLocale: rest === "/" ? "/" : rest.replace(/\/+$/, "") || "/",
  };
}

export function localizePath(pathname: string, locale: string): string {
  const normalizedLocale = normalizeLocaleSlug(locale) ?? DEFAULT_LOCALE;
  const { pathnameWithoutLocale } = stripLocalePrefix(pathname);
  if (normalizedLocale === DEFAULT_LOCALE) {
    return pathnameWithoutLocale;
  }
  return pathnameWithoutLocale === "/"
    ? `/${normalizedLocale}`
    : `/${normalizedLocale}${pathnameWithoutLocale}`;
}

export function buildLocaleAlternates(pathname: string, activeLocale: string) {
  const languages: Record<string, string> = {
    "x-default": localizePath(pathname, DEFAULT_LOCALE),
  };
  for (const loc of SUPPORTED_LOCALES) {
    languages[loc.hreflang] = localizePath(pathname, loc.slug);
  }
  return {
    canonical: localizePath(pathname, activeLocale),
    languages,
  };
}

export function formatCompactCurrency(
  amount: number | null | undefined,
  currency = "USD",
  locale = "en",
): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) {
    return "—";
  }
  const { intlCode } = getLocaleMeta(locale);
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  let suffix = "";
  let scaled = abs;
  if (abs >= 1e12) {
    scaled = abs / 1e12;
    suffix = "T";
  } else if (abs >= 1e9) {
    scaled = abs / 1e9;
    suffix = "B";
  } else if (abs >= 1e6) {
    scaled = abs / 1e6;
    suffix = "M";
  } else if (abs >= 1e3) {
    scaled = abs / 1e3;
    suffix = "K";
  }

  const sym = currency === "USD" ? "$" : `${currency} `;
  const formatted = new Intl.NumberFormat(intlCode, {
    maximumFractionDigits: scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2,
  }).format(scaled);
  return `${sign}${sym}${formatted}${suffix}`;
}

export function formatCompactNumber(
  val: number | null | undefined,
  locale = "en",
): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return "—";
  const { intlCode } = getLocaleMeta(locale);
  return new Intl.NumberFormat(intlCode, {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(val);
}

export function formatPercent(
  val: number | null | undefined,
  showSign = true,
): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return "—";
  const sign = showSign && val > 0 ? "+" : "";
  return `${sign}${val.toFixed(1)}%`;
}
