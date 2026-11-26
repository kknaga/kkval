import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "kkval.com",
    short_name: "kkval",
    description:
      "Free SEC EDGAR health check, cash runway, share dilution, Form 4 insiders, and 13F institutional holders.",
    start_url: "/",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#10b981",
    icons: [
      {
        src: "/logo.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
