"use client";

import { usePathname, useRouter } from "next/navigation";
import { localizePath, SUPPORTED_LOCALES } from "@/lib/i18n/locales";

interface LanguageSwitcherProps {
  currentLocale: string;
  label: string;
}

export function LanguageSwitcher({
  currentLocale,
  label,
}: LanguageSwitcherProps) {
  const pathname = usePathname() || "/";
  const router = useRouter();

  return (
    <label className="inline-flex items-center">
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        value={currentLocale}
        onChange={(e) => {
          const nextLocale = e.target.value;
          router.push(localizePath(pathname, nextLocale));
        }}
        className="kk-select h-8 px-2 text-xs font-medium"
      >
        {SUPPORTED_LOCALES.map((loc) => (
          <option key={loc.slug} value={loc.slug}>
            {loc.nativeLabel}
          </option>
        ))}
      </select>
    </label>
  );
}
