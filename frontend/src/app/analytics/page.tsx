"use client";

import { useEffect, useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  Music,
  Mic,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  RefreshCw,
} from "lucide-react";

interface KpiData {
  current: number;
  previous: number;
  change: number;
  ma7: number;
  ma21: number;
  momentum_pct: number;
  acceleration_pct: number;
  trend: string;
  signal: string;
  chart: { date: string; value: number }[];
}

interface Dashboard {
  date: string;
  period_days: number;
  kpis: Record<string, KpiData>;
}

interface ActionItem {
  priority: string;
  area: string;
  finding: string;
  action: string;
}

interface WeeklyReport {
  report_title: string;
  dashboard: Dashboard;
  actionable_items: ActionItem[];
  generated_at: string;
}

const KPI_CONFIG: Record<string, { label: string; icon: typeof Users; color: string }> = {
  total_users: { label: "Total Users", icon: Users, color: "#3b82f6" },
  signups: { label: "Daily Signups", icon: ArrowUpRight, color: "#10b981" },
  sessions_created: { label: "Sessions Created", icon: Music, color: "#8b5cf6" },
  tracks_recorded: { label: "Tracks Recorded", icon: Mic, color: "#ef4444" },
  pro_subscribers: { label: "Pro Subscribers", icon: DollarSign, color: "#FF6B35" },
};

function MiniChart({ data, color }: { data: { date: string; value: number }[]; color: string }) {
  if (!data.length) return null;
  const max = Math.max(...data.map((d) => d.value), 1);
  const width = 120;
  const height = 32;

  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - (d.value / max) * height;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg width={width} height={height} className="opacity-60">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SignalBadge({ signal, momentum }: { signal: string; momentum: number }) {
  if (signal === "bullish") {
    return (
      <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-500">
        <TrendingUp className="h-3 w-3" /> +{momentum}%
      </span>
    );
  }
  if (signal === "bearish") {
    return (
      <span className="flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-400">
        <TrendingDown className="h-3 w-3" /> {momentum}%
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 rounded-full bg-[#1c1b18] px-2 py-0.5 text-[10px] font-bold text-[#6B6560]">
      <Minus className="h-3 w-3" /> {momentum}%
    </span>
  );
}

export default function AnalyticsPage() {
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);

  const loadReport = async () => {
    setLoading(true);
    try {
      // Compute first, then fetch report
      await fetch("/api/analytics/compute", { method: "POST" });
      const res = await fetch("/api/analytics/weekly-report");
      const data = await res.json();
      setReport(data);
    } catch {
      // silent
    }
    setLoading(false);
  };

  useEffect(() => { loadReport(); }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#FF6B35]" />
      </div>
    );
  }

  const dashboard = report?.dashboard;
  const kpis = dashboard?.kpis || {};

  return (
    <div className="min-h-screen pb-32">
      <div className="mx-auto max-w-5xl px-5 pt-12 sm:px-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-[32px] font-light italic text-[#F0EDE8]">
              Analytics
            </h1>
            <p className="mt-1 text-[12px] text-[#6B6560]">
              KPI dashboard with momentum signals — 7d vs 21d moving averages
            </p>
          </div>
          <button
            type="button"
            onClick={loadReport}
            className="flex items-center gap-2 rounded-lg border border-[#1c1b18] bg-[#0a0a09] px-3 py-2 text-[11px] font-medium text-[#6B6560] transition hover:text-[#F0EDE8]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-8">
          {Object.entries(KPI_CONFIG).map(([key, config]) => {
            const kpi = kpis[key];
            if (!kpi) return null;
            const Icon = config.icon;

            return (
              <div
                key={key}
                className="rounded-xl border border-[#1c1b18] bg-[#0a0a09] p-5"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="flex h-7 w-7 items-center justify-center rounded-lg"
                      style={{ backgroundColor: config.color + "15" }}
                    >
                      <Icon className="h-3.5 w-3.5" style={{ color: config.color }} />
                    </div>
                    <span className="text-[11px] font-semibold text-[#6B6560]">
                      {config.label}
                    </span>
                  </div>
                  <SignalBadge signal={kpi.signal} momentum={kpi.momentum_pct} />
                </div>

                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-[28px] font-bold text-[#F0EDE8] leading-none">
                      {kpi.current}
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-[10px] text-[#3A3632]">
                      <span>7d avg: {kpi.ma7}</span>
                      <span>·</span>
                      <span>21d avg: {kpi.ma21}</span>
                    </div>
                  </div>
                  <MiniChart data={kpi.chart} color={config.color} />
                </div>

                {/* Trend indicator */}
                <div className="mt-3 flex items-center gap-1.5 text-[10px]">
                  {kpi.trend === "accelerating" ? (
                    <span className="flex items-center gap-0.5 text-emerald-500">
                      <ArrowUpRight className="h-3 w-3" /> Accelerating
                    </span>
                  ) : kpi.trend === "decelerating" ? (
                    <span className="flex items-center gap-0.5 text-red-400">
                      <ArrowDownRight className="h-3 w-3" /> Decelerating
                    </span>
                  ) : (
                    <span className="text-[#3A3632]">Flat</span>
                  )}
                  <span className="text-[#231F1C]">·</span>
                  <span className="text-[#3A3632]">
                    {kpi.change >= 0 ? "+" : ""}{kpi.change} vs yesterday
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Actionable Items */}
        {report?.actionable_items && report.actionable_items.length > 0 && (
          <div className="rounded-xl border border-[#1c1b18] bg-[#0a0a09] p-6">
            <h2 className="text-[14px] font-bold text-[#F0EDE8] mb-4">
              Actionable Items
            </h2>
            <div className="space-y-3">
              {report.actionable_items.map((item, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-[#1c1b18] bg-[#111110] p-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                        item.priority === "high"
                          ? "bg-red-500/10 text-red-400"
                          : item.priority === "medium"
                            ? "bg-amber-500/10 text-amber-500"
                            : "bg-[#1c1b18] text-[#6B6560]"
                      }`}
                    >
                      {item.priority}
                    </span>
                    <span className="text-[11px] font-semibold text-[#6B6560]">
                      {item.area}
                    </span>
                  </div>
                  <p className="text-[12px] text-[#F0EDE8] mb-1">{item.finding}</p>
                  <p className="text-[11px] text-[#6B6560]">{item.action}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Report timestamp */}
        {report && (
          <p className="mt-4 text-center text-[10px] text-[#231F1C]">
            Generated: {new Date(report.generated_at).toLocaleString()}
          </p>
        )}
      </div>
    </div>
  );
}
