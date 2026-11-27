import { getIndexableCount } from "@/lib/queries/companies";
import { COMPANIES_PER_SITEMAP, SITE_URL } from "@/lib/seo";

export const dynamic = "force-dynamic";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const total = await getIndexableCount();
  const companyChunks = Math.ceil(total / COMPANIES_PER_SITEMAP);
  const lastmod = new Date().toISOString();

  const locs: string[] = [`${SITE_URL}/sitemaps/0.xml`];
  for (let i = 1; i <= companyChunks; i++) {
    locs.push(`${SITE_URL}/sitemaps/${i}.xml`);
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${locs
  .map(
    (loc) => `  <sitemap>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${lastmod}</lastmod>
  </sitemap>`,
  )
  .join("\n")}
</sitemapindex>
`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=3600",
    },
  });
}
