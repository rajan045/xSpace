import React from "react";
import { ExternalLink } from "lucide-react";
import { AppLogo } from "@/components/AppLogo";

type Props = {
  daysLeft: number;
  onDismiss: () => void;
  onBuy: () => void;
};

export function TrialWelcomeModal({ daysLeft, onDismiss, onBuy }: Props) {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="trial-welcome-title"
    >
      <div className="no-drag w-full max-w-[400px] rounded-2xl border border-white/[0.1] bg-[#2a2a2c] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.65)]">
        <div className="mb-4 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-400/25 bg-[#1e1e1e] p-1.5">
            <AppLogo size={56} className="rounded-[10px]" />
          </div>
        </div>
        <h2
          id="trial-welcome-title"
          className="text-center text-[17px] font-semibold tracking-tight text-white/95"
        >
          You&apos;re on a free trial
        </h2>
        <p className="mt-2 text-center text-[13px] leading-relaxed text-white/55">
          Full access to xSpace for <strong className="text-white/75">{daysLeft} more {daysLeft === 1 ? "day" : "days"}</strong>. After
          that, purchase a one-time license to keep using the app.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-lg border border-white/[0.12] bg-white/[0.06] px-4 py-2.5 text-[13px] font-medium text-white/90 transition hover:bg-white/[0.1]"
          >
            Continue
          </button>
          <button
            type="button"
            onClick={onBuy}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent-blue px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-accent-blue/90"
          >
            Buy license
            <ExternalLink size={14} className="opacity-90" />
          </button>
        </div>
        <p className="mt-4 text-center text-[11px] text-white/35">
          You can buy anytime from the banner at the top of the app.
        </p>
      </div>
    </div>
  );
}
