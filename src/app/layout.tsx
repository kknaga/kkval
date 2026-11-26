import type { Metadata, Viewport } from "next";
import { Space_Grotesk } from "next/font/google";
import { headers } from "next/headers";
import { GoogleTagManager } from "@next/third-parties/google";
import { DEFAULT_LOCALE, normalizeLocaleSlug } from "@/lib/i18n/locales";
import { SITE_URL } from "@/lib/seo";
import "./globals.css";

const brandFont = Space_Grotesk({
  subsets: ["latin"],
  weight: ["700"],
  variable: "--font-brand",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: "kkval.com",
  title: {
    default: "kkval.com | SEC Company Health Check, Cash Runway & Dilution",
    template: "%s",
  },
  description:
    "Free SEC EDGAR health checks for US-listed stocks: cash runway, share dilution, free cash flow, Form 4 insider trades, and 13F institutional holders.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/logo.svg", type: "image/svg+xml" }],
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    siteName: "kkval.com",
    title: "kkval.com | SEC Company Health Check, Cash Runway & Dilution",
    description:
      "Free SEC EDGAR health checks for US-listed stocks: cash runway, share dilution, free cash flow, Form 4 insider trades, and 13F institutional holders.",
  },
  twitter: {
    card: "summary_large_image",
    title: "kkval.com | SEC Company Health Check, Cash Runway & Dilution",
    description:
      "Free SEC EDGAR health checks for US-listed stocks: cash runway, share dilution, free cash flow, Form 4 insider trades, and 13F institutional holders.",
  },
};

const FOUC_SCRIPT = `try{var s=localStorage.getItem("color-scheme");if(s==="light"||s==="dark"){document.querySelector('meta[name="color-scheme"]').content=s;}}catch(e){}`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headerList = await headers();
  const locale =
    normalizeLocaleSlug(headerList.get("x-kkval-locale")) ?? DEFAULT_LOCALE;
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID?.trim() || "GTM-MPSFVHMS";
  const adsenseClient = process.env.NEXT_PUBLIC_ADSENSE_CLIENT?.trim();

  return (
    <html
      lang={locale}
      className={brandFont.variable}
      suppressHydrationWarning
    >
      <head>
        <meta name="color-scheme" content="light dark" />
        <script dangerouslySetInnerHTML={{ __html: FOUC_SCRIPT }} />
        {adsenseClient && (
          <script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClient}`}
            crossOrigin="anonymous"
          />
        )}
      </head>
      {gtmId && <GoogleTagManager gtmId={gtmId} />}
      <body className="flex min-h-screen flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        {children}
      </body>
    </html>
  );
}
