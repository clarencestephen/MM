export type SongStatus = "draft" | "generated" | "transformed" | "exported";

const statusConfig: Record<SongStatus, { label: string; classes: string }> = {
  draft: {
    label: "Draft",
    classes: "bg-zinc-500/15 text-zinc-400 ring-zinc-500/30",
  },
  generated: {
    label: "Generated",
    classes: "bg-violet-500/15 text-violet-500 ring-violet-500/30",
  },
  transformed: {
    label: "Transformed",
    classes: "bg-emerald-500/15 text-emerald-500 ring-emerald-500/30",
  },
  exported: {
    label: "Exported",
    classes: "bg-sky-500/15 text-sky-500 ring-sky-500/30",
  },
};

interface StatusBadgeProps {
  status: SongStatus;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status];
  if (!config) return null;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${config.classes}`}
    >
      {config.label}
    </span>
  );
}
