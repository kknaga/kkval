CREATE TABLE "companies" (
	"cik" text PRIMARY KEY NOT NULL,
	"ticker" text NOT NULL,
	"all_tickers" text[] DEFAULT '{}'::text[] NOT NULL,
	"name" text NOT NULL,
	"exchange" text,
	"sic" text,
	"sic_description" text,
	"entity_class" text DEFAULT 'operating' NOT NULL,
	"filer_category" text,
	"fiscal_year_end" text,
	"state_of_incorporation" text,
	"reporting_currency" text DEFAULT 'USD' NOT NULL,
	"is_indexable" boolean DEFAULT false NOT NULL,
	"periods_count" integer DEFAULT 0 NOT NULL,
	"last_filing_date" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "companies_ticker_unique" UNIQUE("ticker")
);
--> statement-breakpoint
CREATE TABLE "company_health_snapshots" (
	"cik" text PRIMARY KEY NOT NULL,
	"verdict" text DEFAULT 'watch' NOT NULL,
	"cash_runway_months" double precision,
	"is_cash_flow_positive" boolean,
	"quarterly_burn_native" double precision,
	"quarterly_burn_usd" double precision,
	"total_liquidity_native" double precision,
	"total_liquidity_usd" double precision,
	"share_dilution_1y_pct" double precision,
	"share_dilution_3y_pct" double precision,
	"possible_reverse_split" boolean DEFAULT false NOT NULL,
	"debt_to_cash_ratio" double precision,
	"net_cash_usd" double precision,
	"fcf_ttm_native" double precision,
	"fcf_ttm_usd" double precision,
	"revenue_ttm_native" double precision,
	"revenue_ttm_usd" double precision,
	"revenue_growth_yoy_pct" double precision,
	"net_margin_pct" double precision,
	"operating_margin_pct" double precision,
	"margin_trend" text DEFAULT 'unknown' NOT NULL,
	"offering_filings_12m" integer DEFAULT 0 NOT NULL,
	"insider_net_buy_90d_usd" double precision,
	"insider_buy_count_90d" integer DEFAULT 0 NOT NULL,
	"insider_sell_count_90d" integer DEFAULT 0 NOT NULL,
	"top_institutional_count" integer DEFAULT 0 NOT NULL,
	"warnings_json" jsonb NOT NULL,
	"summary_data_json" jsonb NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cusip_map" (
	"cusip" text PRIMARY KEY NOT NULL,
	"cik" text,
	"ticker" text,
	"issuer_name" text,
	"security_type" text,
	"source" text DEFAULT 'openfigi' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_periods" (
	"cik" text NOT NULL,
	"period_type" text NOT NULL,
	"period_end" text NOT NULL,
	"fiscal_year" smallint,
	"fiscal_period" text,
	"currency" text DEFAULT 'USD' NOT NULL,
	"revenue" double precision,
	"gross_profit" double precision,
	"operating_income" double precision,
	"net_income" double precision,
	"cash_and_equivalents" double precision,
	"short_term_investments" double precision,
	"total_liquidity" double precision,
	"operating_cash_flow" double precision,
	"capex" double precision,
	"free_cash_flow" double precision,
	"total_debt" double precision,
	"shares_outstanding" double precision,
	"is_decumulated" boolean DEFAULT false NOT NULL,
	"provenance_json" jsonb NOT NULL,
	CONSTRAINT "financial_periods_cik_period_type_period_end_pk" PRIMARY KEY("cik","period_type","period_end")
);
--> statement-breakpoint
CREATE TABLE "fx_rates" (
	"currency" text PRIMARY KEY NOT NULL,
	"rate_per_usd" double precision NOT NULL,
	"as_of_date" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingestion_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_type" text NOT NULL,
	"status" text NOT NULL,
	"processed_count" integer DEFAULT 0 NOT NULL,
	"error_count" integer DEFAULT 0 NOT NULL,
	"details_json" jsonb,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "insider_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"cik" text NOT NULL,
	"accn" text NOT NULL,
	"filing_date" text NOT NULL,
	"transaction_date" text DEFAULT '' NOT NULL,
	"owner_name" text NOT NULL,
	"owner_title" text,
	"is_director" boolean DEFAULT false NOT NULL,
	"is_officer" boolean DEFAULT false NOT NULL,
	"is_ten_percent_owner" boolean DEFAULT false NOT NULL,
	"transaction_code" text NOT NULL,
	"acquired_disposed" text,
	"shares" double precision DEFAULT 0 NOT NULL,
	"price_per_share" double precision DEFAULT 0 NOT NULL,
	"total_value_usd" double precision,
	"shares_after" double precision,
	"is_open_market" boolean DEFAULT false NOT NULL,
	"primary_document" text
);
--> statement-breakpoint
CREATE TABLE "institutional_holdings" (
	"id" serial PRIMARY KEY NOT NULL,
	"cik" text NOT NULL,
	"quarter_end" text NOT NULL,
	"manager_cik" text NOT NULL,
	"manager_name" text NOT NULL,
	"cusip" text NOT NULL,
	"shares" double precision,
	"value_usd" double precision,
	"put_call" text DEFAULT '' NOT NULL,
	"filing_accn" text
);
--> statement-breakpoint
CREATE TABLE "recent_filings" (
	"accn" text PRIMARY KEY NOT NULL,
	"cik" text NOT NULL,
	"form" text NOT NULL,
	"filing_date" text NOT NULL,
	"report_date" text,
	"primary_document" text,
	"description" text,
	"is_dilution_filing" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "company_health_snapshots" ADD CONSTRAINT "company_health_snapshots_cik_companies_cik_fk" FOREIGN KEY ("cik") REFERENCES "public"."companies"("cik") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_periods" ADD CONSTRAINT "financial_periods_cik_companies_cik_fk" FOREIGN KEY ("cik") REFERENCES "public"."companies"("cik") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insider_transactions" ADD CONSTRAINT "insider_transactions_cik_companies_cik_fk" FOREIGN KEY ("cik") REFERENCES "public"."companies"("cik") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "institutional_holdings" ADD CONSTRAINT "institutional_holdings_cik_companies_cik_fk" FOREIGN KEY ("cik") REFERENCES "public"."companies"("cik") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recent_filings" ADD CONSTRAINT "recent_filings_cik_companies_cik_fk" FOREIGN KEY ("cik") REFERENCES "public"."companies"("cik") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "companies_ticker_lower_idx" ON "companies" USING btree (LOWER("ticker"));--> statement-breakpoint
CREATE INDEX "companies_indexable_class_idx" ON "companies" USING btree ("is_indexable","entity_class");--> statement-breakpoint
CREATE INDEX "companies_sic_idx" ON "companies" USING btree ("sic");--> statement-breakpoint
CREATE INDEX "health_runway_idx" ON "company_health_snapshots" USING btree ("cash_runway_months");--> statement-breakpoint
CREATE INDEX "health_dilution_idx" ON "company_health_snapshots" USING btree ("share_dilution_1y_pct");--> statement-breakpoint
CREATE INDEX "health_insider_net_idx" ON "company_health_snapshots" USING btree ("insider_net_buy_90d_usd");--> statement-breakpoint
CREATE INDEX "health_fcf_idx" ON "company_health_snapshots" USING btree ("fcf_ttm_usd");--> statement-breakpoint
CREATE INDEX "health_debt_cash_idx" ON "company_health_snapshots" USING btree ("debt_to_cash_ratio");--> statement-breakpoint
CREATE INDEX "financial_periods_cik_type_end_idx" ON "financial_periods" USING btree ("cik","period_type","period_end");--> statement-breakpoint
CREATE UNIQUE INDEX "insider_tx_dedupe_uidx" ON "insider_transactions" USING btree ("accn","owner_name","transaction_date","transaction_code","shares","price_per_share");--> statement-breakpoint
CREATE INDEX "insider_tx_cik_filing_idx" ON "insider_transactions" USING btree ("cik","filing_date");--> statement-breakpoint
CREATE UNIQUE INDEX "inst_holdings_uidx" ON "institutional_holdings" USING btree ("cik","quarter_end","manager_cik","cusip","put_call");--> statement-breakpoint
CREATE INDEX "inst_holdings_cik_q_val_idx" ON "institutional_holdings" USING btree ("cik","quarter_end","value_usd");--> statement-breakpoint
CREATE INDEX "recent_filings_cik_date_idx" ON "recent_filings" USING btree ("cik","filing_date");