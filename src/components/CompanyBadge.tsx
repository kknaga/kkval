const TONE_CLASSES = [
  "bg-emerald-100 text-emerald-800 ring-emerald-200/80 dark:bg-emerald-950/70 dark:text-emerald-300 dark:ring-emerald-900/60",
  "bg-sky-100 text-sky-800 ring-sky-200/80 dark:bg-sky-950/70 dark:text-sky-300 dark:ring-sky-900/60",
  "bg-indigo-100 text-indigo-800 ring-indigo-200/80 dark:bg-indigo-950/70 dark:text-indigo-300 dark:ring-indigo-900/60",
  "bg-amber-100 text-amber-800 ring-amber-200/80 dark:bg-amber-950/70 dark:text-amber-300 dark:ring-amber-900/60",
  "bg-rose-100 text-rose-800 ring-rose-200/80 dark:bg-rose-950/70 dark:text-rose-300 dark:ring-rose-900/60",
  "bg-teal-100 text-teal-800 ring-teal-200/80 dark:bg-teal-950/70 dark:text-teal-300 dark:ring-teal-900/60",
  "bg-violet-100 text-violet-800 ring-violet-200/80 dark:bg-violet-950/70 dark:text-violet-300 dark:ring-violet-900/60",
  "bg-slate-100 text-slate-800 ring-slate-200/80 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-800",
] as const;

function hashIndex(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % TONE_CLASSES.length;
}

const BADGE_SIZE_STYLES = {
  md: "h-12 w-12 rounded-xl text-xs",
  lg: "h-16 w-16 rounded-2xl text-sm",
} as const;

export function CompanyBadge({
  ticker,
  size = "md",
}: {
  ticker: string;
  size?: keyof typeof BADGE_SIZE_STYLES;
}) {
  const toneClass = TONE_CLASSES[hashIndex(ticker)];
  const clean = ticker.trim().toUpperCase().slice(0, 5);

  return (
    <div
      aria-hidden="true"
      className={`${BADGE_SIZE_STYLES[size]} ${toneClass} flex shrink-0 items-center justify-center font-mono font-bold tracking-tight ring-1 select-none`}
    >
      {clean}
    </div>
  );
}
