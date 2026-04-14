import type { Genre } from "@/lib/types";

const genreConfig: Record<Genre, { label: string; classes: string }> = {
  hip_hop: {
    label: "Hip Hop",
    classes: "bg-orange-500/15 text-orange-500 ring-orange-500/30",
  },
  melodic_rap: {
    label: "Melodic Rap",
    classes: "bg-pink-500/15 text-pink-500 ring-pink-500/30",
  },
  rnb: {
    label: "R&B",
    classes: "bg-blue-500/15 text-blue-500 ring-blue-500/30",
  },
  lofi: {
    label: "Lo-Fi",
    classes: "bg-green-500/15 text-green-500 ring-green-500/30",
  },
};

interface GenreBadgeProps {
  genre: Genre;
}

export default function GenreBadge({ genre }: GenreBadgeProps) {
  const config = genreConfig[genre];
  if (!config) return null;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${config.classes}`}
    >
      {config.label}
    </span>
  );
}
