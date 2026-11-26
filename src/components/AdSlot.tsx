"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    adsbygoogle?: Array<Record<string, unknown>>;
  }
}

interface AdSlotProps {
  slotId?: string;
  variant: "leaderboard" | "in-article" | "sidebar";
}

const SIZE_CLASSES: Record<AdSlotProps["variant"], string> = {
  leaderboard: "min-h-[90px] w-full",
  "in-article": "min-h-[120px] w-full",
  sidebar: "min-h-[250px] w-full",
};

export function AdSlot({ slotId, variant }: AdSlotProps) {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  const resolvedSlot =
    slotId ||
    (variant === "leaderboard"
      ? process.env.NEXT_PUBLIC_ADSENSE_SLOT_TOP
      : variant === "in-article"
        ? process.env.NEXT_PUBLIC_ADSENSE_SLOT_MID
        : process.env.NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR);

  const pushed = useRef(false);

  useEffect(() => {
    if (!client || !resolvedSlot || pushed.current) return;
    try {
      pushed.current = true;
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // Ignore AdSense block/adblocker errors
    }
  }, [client, resolvedSlot]);

  if (!client || !resolvedSlot) {
    return null;
  }

  return (
    <aside
      aria-label="Advertisement"
      className={`my-4 flex items-center justify-center overflow-hidden rounded-lg border border-zinc-200/70 bg-zinc-100/50 dark:border-zinc-800/70 dark:bg-zinc-900/40 ${SIZE_CLASSES[variant]}`}
    >
      <ins
        className="adsbygoogle block w-full text-center"
        data-ad-client={client}
        data-ad-slot={resolvedSlot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
}
