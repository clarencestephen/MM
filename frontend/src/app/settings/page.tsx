"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  Server,
  Cpu,
  HardDrive,
  Database,
  Film,
  Brain,
  ExternalLink,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { healthCheck } from "@/lib/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GpuInfo {
  gpu: number;
  name: string;
  vram_used_gb: number;
  vram_total_gb: number;
  utilization_pct: number;
}

interface HealthData {
  status: string;
  services?: {
    ollama?: boolean;
    ffmpeg?: boolean;
    database?: boolean;
  };
  models?: Record<string, boolean>;
  gpu?: GpuInfo[];
  [key: string]: unknown;
}

type ServiceStatus = "healthy" | "degraded" | "down" | "unknown";

// ---------------------------------------------------------------------------
// Status Dot
// ---------------------------------------------------------------------------

function StatusDot({ status }: { status: ServiceStatus }) {
  const colors: Record<ServiceStatus, string> = {
    healthy: "bg-green-500 shadow-green-500/50",
    degraded: "bg-yellow-500 shadow-yellow-500/50",
    down: "bg-red-500 shadow-red-500/50",
    unknown: "bg-zinc-600",
  };
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full shadow-sm ${colors[status]}`}
    />
  );
}

// ---------------------------------------------------------------------------
// Service Row
// ---------------------------------------------------------------------------

function ServiceRow({
  icon: Icon,
  name,
  status,
  detail,
}: {
  icon: typeof Server;
  name: string;
  status: ServiceStatus;
  detail?: string;
}) {
  const statusLabel: Record<ServiceStatus, string> = {
    healthy: "Healthy",
    degraded: "Degraded",
    down: "Down",
    unknown: "Unknown",
  };

  return (
    <div className="flex items-center gap-4 rounded-lg bg-zinc-800/50 px-4 py-3">
      <Icon className="h-5 w-5 flex-shrink-0 text-zinc-500" />
      <div className="flex-1">
        <p className="text-sm font-medium text-zinc-200">{name}</p>
        {detail && <p className="text-xs text-zinc-500">{detail}</p>}
      </div>
      <div className="flex items-center gap-2">
        <StatusDot status={status} />
        <span
          className={`text-xs font-medium ${
            status === "healthy"
              ? "text-green-400"
              : status === "degraded"
              ? "text-yellow-400"
              : status === "down"
              ? "text-red-400"
              : "text-zinc-500"
          }`}
        >
          {statusLabel[status]}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qualityDefault, setQualityDefault] = useState<"draft" | "render">(
    "draft"
  );

  async function fetchHealth() {
    setLoading(true);
    setError(null);
    try {
      const res = await healthCheck();
      setHealth(res as HealthData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reach backend");
      setHealth(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchHealth();
  }, []);

  const backendStatus: ServiceStatus = health
    ? health.status === "ok" || health.status === "healthy"
      ? "healthy"
      : "degraded"
    : error
    ? "down"
    : "unknown";

  function svcStatus(flag: boolean | undefined): ServiceStatus {
    if (flag === undefined) return "unknown";
    return flag ? "healthy" : "down";
  }

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-100">Settings</h1>
            <p className="mt-1 text-sm text-zinc-500">
              System health and configuration.
            </p>
          </div>
          <button
            onClick={fetchHealth}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-700 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Refresh
          </button>
        </div>

        <div className="flex flex-col gap-6">
          {/* ─── Backend Health ─────────────────────────────────────── */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
            <div className="mb-4 flex items-center gap-3">
              <Activity className="h-5 w-5 text-violet-400" />
              <h2 className="text-sm font-semibold text-zinc-200">
                Backend Health
              </h2>
              <div className="ml-auto flex items-center gap-2">
                <StatusDot status={backendStatus} />
                <span
                  className={`text-xs font-medium ${
                    backendStatus === "healthy"
                      ? "text-green-400"
                      : backendStatus === "down"
                      ? "text-red-400"
                      : "text-yellow-400"
                  }`}
                >
                  {backendStatus === "healthy"
                    ? "Connected"
                    : backendStatus === "down"
                    ? "Unreachable"
                    : "Checking..."}
                </span>
              </div>
            </div>

            {error && (
              <div className="mb-4 rounded-md bg-red-500/10 px-4 py-3 text-xs text-red-400">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <ServiceRow
                icon={Brain}
                name="Ollama"
                status={svcStatus(health?.services?.ollama)}
                detail="Local LLM for lyrics & prompts"
              />
              <ServiceRow
                icon={Film}
                name="FFmpeg"
                status={svcStatus(health?.services?.ffmpeg)}
              />
              <ServiceRow
                icon={Database}
                name="Database"
                status={svcStatus(health?.services?.database)}
              />
            </div>
          </div>

          {/* ─── System Info ───────────────────────────────────────── */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
            <div className="mb-4 flex items-center gap-3">
              <Server className="h-5 w-5 text-violet-400" />
              <h2 className="text-sm font-semibold text-zinc-200">
                System Info
              </h2>
            </div>

            <div className="flex flex-col gap-3">
              {/* GPU Info */}
              {health?.gpu && Array.isArray(health.gpu) && health.gpu.map((g) => (
                <div key={g.gpu} className="rounded-lg bg-zinc-800/50 px-4 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <Cpu className="h-4 w-4 text-zinc-500" />
                      <span className="text-sm text-zinc-400">GPU {g.gpu}</span>
                    </div>
                    <span className="text-sm font-medium text-zinc-200">
                      {g.name}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-zinc-700 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-violet-500 transition-all"
                      style={{ width: `${Math.max(g.utilization_pct, 1)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-zinc-600">
                    {g.vram_used_gb} / {g.vram_total_gb} GB ({g.utilization_pct}%)
                  </p>
                </div>
              ))}

              {/* Model Status */}
              {health?.models && (
                <div className="rounded-lg bg-zinc-800/50 px-4 py-3">
                  <div className="flex items-center gap-3 mb-2">
                    <Brain className="h-4 w-4 text-zinc-500" />
                    <span className="text-sm text-zinc-400">Models</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(health.models).map(([name, loaded]) => (
                      <span
                        key={name}
                        className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ${
                          loaded
                            ? "bg-green-500/10 text-green-400"
                            : "bg-zinc-700/50 text-zinc-500"
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${loaded ? "bg-green-500" : "bg-zinc-600"}`} />
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {!health?.gpu && !health?.models && !loading && (
                <p className="py-4 text-center text-xs text-zinc-600">
                  {error
                    ? "Unable to fetch system info."
                    : "No additional system info available."}
                </p>
              )}
            </div>
          </div>

          {/* ─── Quality Default ───────────────────────────────────── */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
            <div className="mb-4 flex items-center gap-3">
              <Cpu className="h-5 w-5 text-violet-400" />
              <h2 className="text-sm font-semibold text-zinc-200">
                Defaults
              </h2>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-zinc-300">Default Quality</p>
                <p className="text-xs text-zinc-600">
                  Used for generation when no quality is specified.
                </p>
              </div>
              <div className="flex gap-1 rounded-lg bg-zinc-800 p-1">
                <button
                  onClick={() => setQualityDefault("draft")}
                  className={`rounded-md px-4 py-1.5 text-xs font-medium transition-colors ${
                    qualityDefault === "draft"
                      ? "bg-violet-600 text-white"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  Draft
                </button>
                <button
                  onClick={() => setQualityDefault("render")}
                  className={`rounded-md px-4 py-1.5 text-xs font-medium transition-colors ${
                    qualityDefault === "render"
                      ? "bg-violet-600 text-white"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  Render
                </button>
              </div>
            </div>
          </div>

          {/* ─── API Docs ─────────────────────────────────────────── */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
            <a
              href="/api/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 text-zinc-400 transition-colors hover:text-violet-400"
            >
              <ExternalLink className="h-5 w-5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-zinc-300">
                  API Documentation
                </p>
                <p className="text-xs text-zinc-600">
                  Interactive Swagger UI for all backend endpoints.
                </p>
              </div>
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
