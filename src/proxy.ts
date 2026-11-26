import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE, normalizeLocaleSlug } from "@/lib/i18n/locales";

const RESERVED_TOP_SEGMENTS = new Set([
  "stock",
  "compare",
  "screen",
  "methodology",
  "privacy",
  "terms",
  "api",
  "sitemap",
  "sitemap.xml",
  "robots.txt",
  "ads.txt",
  "manifest.webmanifest",
]);

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const segments = pathname.split("/");
  const firstSegment = segments[1] ?? "";
  const matchedLocale = normalizeLocaleSlug(firstSegment);

  // Redirect explicit /en or /en/... to unprefixed default URL (308 permanent)
  if (matchedLocale === DEFAULT_LOCALE) {
    const rest = `/${segments.slice(2).join("/")}`;
    const targetPath = rest === "/" ? "/" : rest.replace(/\/+$/, "") || "/";
    const url = new URL(`${targetPath}${search}`, request.url);
    return NextResponse.redirect(url, 308);
  }

  // Canonicalize uppercase/underscore locale prefixes (e.g. /ZH_TW/... -> /zh-tw/...)
  if (matchedLocale && firstSegment !== matchedLocale) {
    const rest = segments.slice(2).join("/");
    const targetPath = rest ? `/${matchedLocale}/${rest}` : `/${matchedLocale}`;
    const url = new URL(`${targetPath}${search}`, request.url);
    return NextResponse.redirect(url, 308);
  }

  // Bare uppercase ticker shortcut (/AAPL -> /stock/AAPL) without colliding with lowercase locale slugs (/ko, /de, /es, /pt)
  if (
    segments.length === 2 &&
    !RESERVED_TOP_SEGMENTS.has(firstSegment.toLowerCase()) &&
    /^[A-Z]{1,5}(?:-[A-Z])?$/.test(firstSegment)
  ) {
    const url = new URL(`/stock/${firstSegment}${search}`, request.url);
    return NextResponse.redirect(url, 308);
  }

  const requestHeaders = new Headers(request.headers);

  if (matchedLocale) {
    requestHeaders.set("x-kkval-locale", matchedLocale);
    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  // Unprefixed path -> internally rewrite to /en/... without changing URL
  requestHeaders.set("x-kkval-locale", DEFAULT_LOCALE);
  const rewriteUrl = request.nextUrl.clone();
  rewriteUrl.pathname =
    pathname === "/" ? `/${DEFAULT_LOCALE}` : `/${DEFAULT_LOCALE}${pathname}`;

  return NextResponse.rewrite(rewriteUrl, {
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap|opengraph-image|twitter-image|.*\\..*).*)",
  ],
};
