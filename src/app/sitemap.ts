import type { MetadataRoute } from "next";
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
import { absoluteUrl, buildAbsoluteLocaleAlternates } from "@/lib/seo";

export const dynamic = "force-dynamic";

const COMPANIES_PER_SITEMAP = 2_500;

export async function generateSitemaps(): Promise<Array<{ id: number }>> {
  const total = await getIndexableCount();
  const companyChunks = Math.max(1, Math.ceil(total / COMPANIES_PER_SITEMAP));
  const ids: Array<{ id: number }> = [{ id: 0 }];
  for (let i = 1; i <= companyChunks; i++) {
    ids.push({ id: i });
  }
  return ids;
}

function expandLocaleEntries(
  pathname: string,
  changeFrequency: "daily" | "weekly" | "monthly",
  priority: number,
  lastModified?: Date,
): MetadataRoute.Sitemap {
  const alternates = buildAbsoluteLocaleAlternates(pathname);
  return SUPPORTED_LOCALES.map((loc) => ({
    url: absoluteUrl(localizePath(pathname, loc.slug)),
    lastModified,
    changeFrequency,
    priority: loc.slug === DEFAULT_LOCALE ? priority : Math.max(0.3, priority - 0.1),
    alternates: {
      languages: alternates.languages,
    },
  }));
}

export default async function sitemap(props: {
  id: Promise<string>;
}): Promise<MetadataRoute.Sitemap> {
  const rawId = await props.id;
  const id = Number.parseInt(rawId, 10) || 0;

  if (id === 0) {
    const entries: MetadataRoute.Sitemap = [
      ...expandLocaleEntries("/", "daily", 1.0),
      ...expandLocaleEntries("/screen", "daily", 0.9),
      ...expandLocaleEntries("/compare", "weekly", 0.7),
      ...expandLocaleEntries("/methodology", "monthly", 0.6),
      {
        url: absoluteUrl("/privacy"),
        changeFrequency: "monthly",
        priority: 0.3,
      },
      {
        url: absoluteUrl("/terms"),
        changeFrequency: "monthly",
        priority: 0.3,
      },
    ];

    for (const slug of SCREENER_SLUGS) {
      entries.push(...expandLocaleEntries(`/screen/${slug}`, "daily", 0.85));
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

    return entries;
  }

  const offset = (id - 1) * COMPANIES_PER_SITEMAP;
  const rows = await getIndexableTickersChunk(offset, COMPANIES_PER_SITEMAP);
  const entries: MetadataRoute.Sitemap = [];
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
  return entries;
}
