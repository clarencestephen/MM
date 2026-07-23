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
    <div className="relative overflow-hidden rounded-xl border border-[#B432FF]/20 bg-gradient-to-r from-[#B432FF]/[0.06] to-[#B432FF]/[0.02] px-5 py-4">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#B432FF]/10">
          <Sparkles className="h-4 w-4 text-[#B432FF]" />
        </div>
        <div className="flex-1">
          <p className="text-[13px] font-semibold text-[#E0D0F0]">
            Unlock {feature}
          </p>
          <p className="mt-0.5 text-[12px] text-[#8A7FA8]">{message}</p>
          <button
            type="button"
            className="mt-3 rounded-lg bg-[#B432FF] px-4 py-2 text-[12px] font-bold text-white transition hover:bg-[#C758FF]"
          >
            Upgrade to Pro — $10/mo
          </button>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={() => { setDismissed(true); onDismiss?.(); }}
            className="text-[#4A3F60] hover:text-[#8A7FA8] transition"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
