"use client";

import { Sparkles, X } from "lucide-react";
import { useState } from "react";

interface UpgradePromptProps {
  feature: string;
  message: string;
  onDismiss?: () => void;
}

export default function UpgradePrompt({ feature, message, onDismiss }: UpgradePromptProps) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="relative overflow-hidden rounded-xl border border-[#FF6B35]/20 bg-gradient-to-r from-[#FF6B35]/[0.06] to-[#FF6B35]/[0.02] px-5 py-4">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#FF6B35]/10">
          <Sparkles className="h-4 w-4 text-[#FF6B35]" />
        </div>
        <div className="flex-1">
          <p className="text-[13px] font-semibold text-[#F0EDE8]">
            Unlock {feature}
          </p>
          <p className="mt-0.5 text-[12px] text-[#6B6560]">{message}</p>
          <button
            type="button"
            className="mt-3 rounded-lg bg-[#FF6B35] px-4 py-2 text-[12px] font-bold text-black transition hover:bg-[#FF8555]"
          >
            Upgrade to Pro — $10/mo
          </button>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={() => { setDismissed(true); onDismiss?.(); }}
            className="text-[#3A3632] hover:text-[#6B6560] transition"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
