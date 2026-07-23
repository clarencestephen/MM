"use client";

import { useEffect, useState } from "react";

type Status = "loading" | "healthy" | "error";

export default function HealthDot() {
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    let mounted = true;

    async function check() {
      try {
        const res = await fetch("/health");
        if (mounted) setStatus(res.ok ? "healthy" : "error");
      } catch {
        if (mounted) setStatus("error");
      }
    }

    check();
    const interval = setInterval(check, 30_000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const dotColor: Record<Status, string> = {
    loading: "bg-[#4A3F60]",
    healthy: "bg-emerald-600",
    error: "bg-[#FF3388]",
  };

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] font-medium text-[#2D2640]">
        {status === "healthy" ? "local" : status === "error" ? "offline" : "..."}
      </span>
      <span className="relative flex h-1.5 w-1.5">
        {status === "healthy" && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-40" />
        )}
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${dotColor[status]}`} />
      </span>
    </div>
  );
}
