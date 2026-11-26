# kkval.com

Free, ad-supported SEC EDGAR company health check, cash runway, share dilution, Form 4 insider trading, and Form 13F institutional holdings explorer.

---

## Architecture

- **Web App:** Next.js 16 (App Router, TypeScript, SSR + CDN `s-maxage` caching) + Tailwind CSS v4 on **port `3001`**
- **Database:** Isolated PostgreSQL 16 container (`kkval-postgres` on **`127.0.0.1:5433`**) + Drizzle ORM
- **Worker & Pipeline:** Standalone TypeScript ingestion worker (`src/worker/index.ts`) supporting:
  - Full bulk SEC EDGAR streaming (`companyfacts.zip` + `submissions.zip` via `yauzl`)
  - Daily Form 4 raw XML delta ingestion via `form.YYYYMMDD.idx`
  - Quarterly DERA Form 13F institutional holdings + OpenFIGI CUSIP mapping
  - Daily FX normalization via Frankfurter
- **Locales:** English (unprefixed default), `/es`, `/ko`, `/pt`, `/ja`, `/zh-tw`, `/de`
- **Process Management:** PM2 (`kkval-web` + `kkval-worker` in `ecosystem.config.cjs`) behind Cloudflare Tunnel (`cloudflared`)

---

## Local Development & Initial Ingestion

```bash
cp .env.example .env
docker compose up -d postgres
npm install
npx drizzle-kit migrate

# Fast sample (~35 diverse tickers including small-caps, large-caps, foreign ADRs, bank, SPAC)
npm run ingest:sample

# Full US-listed universe (~10,400 tickers via streamed bulk ZIPs)
npm run ingest:bulk
npm run ingest:form4
npm run ingest:13f

npm run dev
```

Open `http://localhost:3001`.

---

## NUC Deployment (Isolated Alongside `kkjax`)

1. Run `./bootstrap.sh` inside `/Users/kkmac/kkval` (or on the NUC).
2. Add `kkval.com` ingress to your existing `/etc/cloudflared/config.yml`:

```yaml
ingress:
  - hostname: kkjax.com
    service: http://localhost:3000
  - hostname: kkval.com
    service: http://localhost:3001
  - hostname: www.kkval.com
    service: http://localhost:3001
  - service: http_status:404
```

3. Run `npm run ingest:bulk && npm run ingest:form4 && npm run ingest:13f` once to populate all verified operating companies, then let `kkval-worker` refresh nightly at 04:30 ET.

---

## Disclaimer

All financial data is derived from public U.S. SEC EDGAR filings (10-K, 10-Q, 20-F, 40-F, 6-K, Form 4, Form 13F) and is provided for informational purposes only. Nothing on kkval.com constitutes investment advice.
