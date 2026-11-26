"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { localizePath } from "@/lib/i18n/locales";
import { canonicalizeComparePair } from "@/lib/seo";

interface ComparePickerProps {
  baseTicker: string;
  locale: string;
  label: string;
  placeholder: string;
  buttonLabel: string;
}

export function ComparePicker({
  baseTicker,
  locale,
  label,
  placeholder,
  buttonLabel,
}: ComparePickerProps) {
  const router = useRouter();
  const [other, setOther] = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const clean = other.trim().toUpperCase();
    if (!clean || clean === baseTicker.toUpperCase()) return;
    const { slug } = canonicalizeComparePair(baseTicker, clean);
    router.push(localizePath(`/compare/${slug}`, locale));
  }

  return (
    <form onSubmit={onSubmit} className="flex items-center gap-2">
      <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
        {label}:
      </span>
      <input
        type="text"
        value={other}
        onChange={(e) => setOther(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-8 w-32 rounded-md border border-zinc-200 bg-white px-2.5 text-xs uppercase text-zinc-900 placeholder:normal-case placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
      />
      <button
        type="submit"
        className="h-8 rounded-md bg-zinc-900 px-3 text-xs font-semibold text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {buttonLabel}
      </button>
    </form>
  );
}
