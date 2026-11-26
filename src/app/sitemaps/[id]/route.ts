import {
  DEFAULT_LOCALE,
  localizePath,
  SUPPORTED_LOCALES,
} from "@/lib/i18n/locales";
import {
  getCuratedPeerPairs,
  getIndexableCount,
  getIndexableTickersChunk,
  SCREENER_SLUGS,
} from "@/lib/queries/companies";
import {
  absoluteUrl,
  buildAbsoluteLocaleAlternates,
  COMPANIES_PER_SITEMAP,
} from "@/lib/seo";

export const dynamic = "force-dynamic";

interface UrlEntry {
  loc: string;
  lastmod?: string;
  changefreq: "daily" | "weekly" | "monthly";
  priority: string;
  alternates?: Record<string, string>;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function expandLocaleEntries(
  pathname: string,
  changefreq: "daily" | "weekly" | "monthly",
  priority: number,
  lastmod?: Date,
): UrlEntry[] {
  const { languages } = buildAbsoluteLocaleAlternates(pathname);
  const iso = lastmod ? lastmod.toISOString() : undefined;

  return SUPPORTED_LOCALES.map((loc) => ({
    loc: absoluteUrl(localizePath(pathname, loc.slug)),
    lastmod: iso,
    changefreq,
    priority: (loc.slug === DEFAULT_LOCALE
      ? priority
      : Math.max(0.3, priority - 0.1)
    ).toFixed(1),
    alternates: languages,
  }));
}

function renderUrlSetXml(entries: UrlEntry[]): string {
  const urlsXml = entries
    .map((e) => {
      const altXml = e.alternates
        ? Object.entries(e.alternates)
            .map(
              ([hreflang, href]) =>
                `    <xhtml:link rel="alternate" hreflang="${escapeXml(hreflang)}" href="${escapeXml(href)}" />`,
            )
            .join("\n")
        : "";

      return [
        "  <url>",
        `    <loc>${escapeXml(e.loc)}</loc>`,
        e.lastmod ? `    <lastmod>${escapeXml(e.lastmod)}</lastmod>` : "",
        `    <changefreq>${e.changefreq}</changefreq>`,
        `    <priority>${e.priority}</priority>`,
        altXml,
        "  </url>",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urlsXml}
</urlset>
`;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await params;
  const match = /^(\d+)\.xml$/.exec(rawId);
  if (!match) {
    return new Response("Not found", { status: 404 });
  }

  const chunkId = Number.parseInt(match[1], 10);
  if (chunkId > 0) {
    const total = await getIndexableCount();
    const maxChunk = Math.max(1, Math.ceil(total / COMPANIES_PER_SITEMAP));
    if (chunkId > maxChunk) {
      return new Response("Not found", { status: 404 });
    }
  }
  const entries: UrlEntry[] = [];

  if (chunkId === 0) {
    entries.push(
      ...expandLocaleEntries("/", "daily", 1.0),
      ...expandLocaleEntries("/screen", "daily", 0.9),
      ...expandLocaleEntries("/compare", "weekly", 0.7),
      ...expandLocaleEntries("/methodology", "monthly", 0.6),
      {
        loc: absoluteUrl("/privacy"),
        changefreq: "monthly",
        priority: "0.3",
      },
      {
        loc: absoluteUrl("/terms"),
        changefreq: "monthly",
        priority: "0.3",
      },
    );

    for (const slug of SCREENER_SLUGS) {
      entries.push(...expandLocaleEntries(`/screen/${slug}`, "daily", 0.8));
    }

    const peerPairs = await getCuratedPeerPairs(250);
    for (const pair of peerPairs) {
      entries.push(
        ...expandLocaleEntries(
          `/compare/${pair.a}-vs-${pair.b}`,
          "weekly",
          0.7,
        ),
      );
    }
  } else {
    const offset = (chunkId - 1) * COMPANIES_PER_SITEMAP;
    const rows = await getIndexableTickersChunk(offset, COMPANIES_PER_SITEMAP);
    for (const row of rows) {
      entries.push(
        ...expandLocaleEntries(
          `/stock/${row.ticker}`,
          "daily",
          0.8,
          row.updatedAt,
        ),
      );
    }
  }

  return new Response(renderUrlSetXml(entries), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=3600",
    },
  });
}
