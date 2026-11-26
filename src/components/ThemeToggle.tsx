"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

interface ThemeToggleProps {
  switchToDarkLabel: string;
  switchToLightLabel: string;
}

function getClientScheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  try {
    const stored = localStorage.getItem("color-scheme");
    if (stored === "dark" || stored === "light") return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  } catch {
    return "light";
  }
}

function subscribeTheme(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const mql = window.matchMedia("(prefers-color-scheme: dark)");
  mql.addEventListener("change", callback);
  window.addEventListener("storage", callback);
  window.addEventListener("kkval-theme-change", callback);
  return () => {
    mql.removeEventListener("change", callback);
    window.removeEventListener("storage", callback);
    window.removeEventListener("kkval-theme-change", callback);
  };
}

export function ThemeToggle({
  switchToDarkLabel,
  switchToLightLabel,
}: ThemeToggleProps) {
  const scheme = useSyncExternalStore<"light" | "dark">(
    subscribeTheme,
    getClientScheme,
    () => "light",
  );

  function toggle() {
    const next = scheme === "dark" ? "light" : "dark";
    try {
      localStorage.setItem("color-scheme", next);
      const meta = document.querySelector('meta[name="color-scheme"]');
      if (meta) meta.setAttribute("content", next);
      window.dispatchEvent(new Event("kkval-theme-change"));
    } catch {
      // Ignore storage errors
    }
  }

  const label = scheme === "dark" ? switchToLightLabel : switchToDarkLabel;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
    >
      {scheme === "dark" ? (
        <Sun className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Moon className="h-4 w-4" aria-hidden="true" />
      )}
    </button>
  );
}
