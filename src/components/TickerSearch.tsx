"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { cleanCompanyName } from "@/lib/format-stake-pct";
import { localizePath } from "@/lib/i18n/locales";

interface SearchHit {
  ticker: string;
  name: string;
  exchange: string | null;
}

interface TickerSearchProps {
  locale: string;
  placeholder: string;
  buttonLabel: string;
  compact?: boolean;
}

export function TickerSearch({
  locale,
  placeholder,
  buttonLabel,
  compact = false,
}: TickerSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query.trim();
    if (!q) return;

    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        if (!res.ok) return;
        const json = (await res.json()) as { results?: SearchHit[] };
        setHits(json.results ?? []);
        setOpen((json.results ?? []).length > 0);
        setActiveIdx(-1);
      } catch {
        // Ignore network abort
      }
    }, 140);

    return () => clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function navigateToTicker(ticker: string) {
    setOpen(false);
    setQuery("");
    router.push(localizePath(`/stock/${ticker.toUpperCase()}`, locale));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (activeIdx >= 0 && hits[activeIdx]) {
      navigateToTicker(hits[activeIdx].ticker);
      return;
    }
    const clean = query.trim().toUpperCase();
    if (!clean) return;
    if (hits.length > 0 && clean.length > 5) {
      navigateToTicker(hits[0].ticker);
      return;
    }
    navigateToTicker(clean.split(/\s+/)[0]);
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <form onSubmit={onSubmit} className="flex w-full items-center gap-2.5">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
            aria-hidden="true"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              const val = e.target.value;
              setQuery(val);
              if (!val.trim()) {
                setHits([]);
                setOpen(false);
              }
            }}
            onFocus={() => hits.length > 0 && setOpen(true)}
            onKeyDown={(e) => {
              if (!open || hits.length === 0) return;
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActiveIdx((i) => Math.min(hits.length - 1, i + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIdx((i) => Math.max(-1, i - 1));
              } else if (e.key === "Escape") {
                setOpen(false);
              }
            }}
            placeholder={placeholder}
            aria-label={placeholder}
            className={`w-full border border-zinc-200 bg-white pl-10 pr-4 text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 ${
              compact ? "h-9 rounded-lg text-xs" : "h-12 rounded-xl text-sm shadow-xs"
            }`}
          />
        </div>
        {!compact && (
          <button
            type="submit"
            className="inline-flex h-12 shrink-0 items-center justify-center rounded-xl bg-emerald-600 px-6 text-sm font-semibold text-white transition-colors hover:bg-emerald-500"
          >
            {buttonLabel}
          </button>
        )}
      </form>

      {open && hits.length > 0 && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full z-40 mt-2 max-h-80 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-1.5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
        >
          {hits.map((h, idx) => (
            <li key={h.ticker}>
              <button
                type="button"
                onClick={() => navigateToTicker(h.ticker)}
                className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                  idx === activeIdx
                    ? "bg-zinc-100 dark:bg-zinc-800"
                    : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400">
                    {h.ticker}
                  </span>
                  <span className="truncate text-zinc-800 dark:text-zinc-200">
                    {cleanCompanyName(h.name) || h.name}
                  </span>
                </div>
                {h.exchange && (
                  <span className="shrink-0 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                    {h.exchange}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
