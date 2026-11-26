import type { Metadata } from "next";
import { normalizeLocaleSlug } from "@/lib/i18n/locales";
import { absoluteUrl } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocaleSlug(rawLocale) ?? "en";

  return {
    title: "Privacy Policy | kkval.com",
    alternates: { canonical: absoluteUrl("/privacy") },
    robots: locale === "en" ? undefined : { index: false, follow: true },
  };
}

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-4 px-4 py-10 text-sm leading-relaxed text-zinc-700 sm:px-6 dark:text-zinc-300">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        Privacy Policy
      </h1>
      <p>
        kkval.com does not require user accounts or registration. Standard web
        server access logs and third-party analytics or advertising cookies
        (such as Google Tag Manager and Google AdSense) may be used to measure
        traffic and display ads.
      </p>
      <p>
        Theme preference (<code>color-scheme</code>) is stored locally in your
        browser via <code>localStorage</code> and is never transmitted to our
        servers.
      </p>
    </article>
  );
}
