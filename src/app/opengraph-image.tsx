import { ImageResponse } from "next/og";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px",
          backgroundColor: "#09090b",
          color: "#fafafa",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
          <div
            style={{
              width: "52px",
              height: "52px",
              borderRadius: "12px",
              border: "2px solid #27272a",
              backgroundColor: "#18181b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#10b981",
              fontSize: "28px",
              fontWeight: 700,
            }}
          >
            $
          </div>
          <div style={{ display: "flex", alignItems: "baseline", fontSize: "38px", fontWeight: 700, letterSpacing: "-0.03em" }}>
            <span>kkval</span>
            <span style={{ color: "#10b981" }}>.com</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div
            style={{
              fontSize: "58px",
              fontWeight: 700,
              lineHeight: 1.12,
              letterSpacing: "-0.02em",
            }}
          >
            SEC Company Health Check
          </div>
          <div style={{ fontSize: "28px", color: "#a1a1aa" }}>
            Cash Runway • Share Dilution • Free Cash Flow • Form 4 Insiders • 13F Funds
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "22px",
            color: "#71717a",
          }}
        >
          <span>100% SEC EDGAR Derived • Free • No Login</span>
          <span style={{ color: "#10b981" }}>kkval.com</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
