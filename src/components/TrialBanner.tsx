import React from "react";
import { ExternalLink } from "lucide-react";
import { AppLogo } from "@/components/AppLogo";
import { PRICING_URL } from "@/constants/pricingUrl";

export function TrialBanner({ daysLeft }: { daysLeft: number }) {
  const openBuy = () => {
    window.electronAPI?.openExternal(PRICING_URL);
  };

  return (
    <div className="no-drag flex shrink-0 items-center justify-between gap-3 border-b border-amber-500/25 bg-amber-500/[0.12] px-4 py-2.5 pr-5">
      <div className="flex min-w-0 items-center gap-2.5 text-[12px] text-amber-100/95">
        <div className="h-7 w-7 shrink-0 rounded-md border border-amber-400/20 bg-[#1e1e1e] p-0.5">
          <AppLogo size={24} className="rounded-[4px]" />
        </div>
        <span className="leading-snug">
          <span className="font-semibold text-amber-50/95">Free trial</span>
          {" — "}
          <span className="text-amber-100/85">
            {daysLeft} {daysLeft === 1 ? "day" : "days"} left
          </span>
          <span className="text-amber-100/70">
            . Then unlock with a one-time license.
          </span>
        </span>
      </div>
      <button
        type="button"
        onClick={openBuy}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-amber-400/95 px-3 py-1.5 text-[12px] font-semibold text-amber-950 shadow-sm transition hover:bg-amber-300"
      >
        Buy license
        <ExternalLink className="h-3.5 w-3.5 opacity-80" strokeWidth={2} />
      </button>
    </div>
  );
}
