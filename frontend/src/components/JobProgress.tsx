"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";
import { getRenderJobStatus, getExportJobStatus } from "@/lib/api";
import type { RenderJob, ExportJob } from "@/lib/types";

interface JobProgressProps {
  jobId: string;
  jobType: "render" | "export";
  onComplete: (result: RenderJob | ExportJob) => void;
}

type StatusIcon = "pending" | "processing" | "completed" | "failed";

function normalizeStatus(status: string): StatusIcon {
  if (status === "done" || status === "completed") return "completed";
  if (status === "running" || status === "processing") return "processing";
  if (status === "failed") return "failed";
  return "pending";
}

const statusConfig: Record<
  StatusIcon,
  { icon: typeof Loader2; label: string; color: string }
> = {
  pending: { icon: Clock, label: "Queued...", color: "text-yellow-500" },
  processing: {
    icon: Loader2,
    label: "Processing...",
    color: "text-violet-400",
  },
  completed: { icon: CheckCircle2, label: "Complete", color: "text-green-500" },
  failed: { icon: XCircle, label: "Failed", color: "text-red-500" },
};

export default function JobProgress({
  jobId,
  jobType,
  onComplete,
}: JobProgressProps) {
  const [status, setStatus] = useState<StatusIcon>("pending");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const result =
          jobType === "render"
            ? await getRenderJobStatus(jobId)
            : await getExportJobStatus(jobId);

        if (cancelled) return;

        const normalized = normalizeStatus(result.status);
        setStatus(normalized);

        if (normalized === "completed" || normalized === "failed") {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          if (normalized === "failed" && result.error) {
            setError(result.error);
          }
          if (normalized === "completed") {
            onCompleteRef.current(result);
          }
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Polling failed");
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    }

    poll();
    intervalRef.current = setInterval(poll, 2000);

    return () => {
      cancelled = true;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [jobId, jobType]);

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-center gap-3">
        <Icon
          className={`h-5 w-5 ${config.color} ${
            status === "processing" ? "animate-spin" : ""
          }`}
        />
        <span className="text-sm font-medium text-zinc-200">
          {config.label}
        </span>
        {progress !== null && status === "processing" && (
          <span className="ml-auto text-xs text-zinc-500">
            {Math.round(progress * 100)}%
          </span>
        )}
      </div>

      {progress !== null && status === "processing" && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full rounded-full bg-violet-500 transition-all duration-300"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      )}

      {error && (
        <div className="rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}
