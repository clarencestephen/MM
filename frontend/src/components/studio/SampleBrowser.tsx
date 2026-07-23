"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Play, Plus, Lock, Sparkles } from "lucide-react";

interface Sample {
  id: string;
  name: string;
  category: string;
  icon: string;
  color: string;
  bpm: number | null;
  key: string | null;
  tags: string;
  is_free: boolean;
  has_audio: boolean;
}

interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  emoji: string;
}

interface SampleBrowserProps {
  onAddSample: (sampleId: string) => void;
  tier: "free" | "pro";
}

const CATEGORY_EMOJIS: Record<string, string> = {
  drums: "🥁",
  bass: "🎸",
  melody: "🎵",
  keys: "🎹",
  guitar: "🎸",
  vocals: "🎤",
  fx: "✨",
  loops: "🔁",
};

export default function SampleBrowser({ onAddSample, tier }: SampleBrowserProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [playing, setPlaying] = useState<string | null>(null);
  const [audioRef, setAudioRef] = useState<HTMLAudioElement | null>(null);

  // Load categories
  useEffect(() => {
    fetch("/api/studio/samples/categories")
      .then((r) => r.json())
      .then(setCategories)
      .catch(() => {});
  }, []);

  // Load samples
  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedCategory) params.set("category", selectedCategory);
    if (search) params.set("search", search);

    fetch(`/api/studio/samples/?${params}`)
      .then((r) => r.json())
      .then(setSamples)
      .catch(() => {});
  }, [selectedCategory, search]);

  const handlePreview = useCallback((sampleId: string) => {
    if (playing === sampleId) {
      audioRef?.pause();
      setPlaying(null);
      return;
    }

    audioRef?.pause();
    const audio = new Audio(`/api/studio/samples/${sampleId}/audio`);
    audio.onended = () => setPlaying(null);
    audio.play();
    setAudioRef(audio);
    setPlaying(sampleId);
  }, [playing, audioRef]);

  return (
    <div className="rounded-2xl border border-[#2A1A4A] bg-[#0D0A14] overflow-hidden">
      {/* Header */}
      <div className="border-b border-[#2A1A4A] px-4 py-3">
        <h3 className="text-[14px] font-bold text-[#E0D0F0] flex items-center gap-2">
          <span className="text-lg">🎶</span> Sound Library
        </h3>

        {/* Search */}
        <div className="mt-2 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#4A3F60]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sounds..."
            className="w-full rounded-lg border border-[#2A1A4A] bg-[#1A0A2E] pl-9 pr-3 py-2 text-[12px] text-[#E0D0F0] placeholder-[#4A3F60] outline-none focus:border-[#B432FF]/30"
          />
        </div>
      </div>

      {/* Category pills */}
      <div className="flex gap-1.5 overflow-x-auto px-4 py-3 border-b border-[#2A1A4A]">
        <button
          type="button"
          onClick={() => setSelectedCategory(null)}
          className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${
            !selectedCategory
              ? "bg-[#B432FF] text-white"
              : "bg-[#1A0A2E] text-[#8A7FA8] hover:text-[#E0D0F0]"
          }`}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setSelectedCategory(cat.id)}
            className={`shrink-0 flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${
              selectedCategory === cat.id
                ? "text-white"
                : "bg-[#1A0A2E] text-[#8A7FA8] hover:text-[#E0D0F0]"
            }`}
            style={selectedCategory === cat.id ? { backgroundColor: cat.color } : {}}
          >
            <span>{CATEGORY_EMOJIS[cat.id] || "🎵"}</span>
            {cat.name}
          </button>
        ))}
      </div>

      {/* Sample list */}
      <div className="max-h-72 overflow-y-auto">
        {samples.length === 0 ? (
          <div className="flex flex-col items-center py-8">
            <span className="text-2xl mb-2">🔍</span>
            <p className="text-[12px] text-[#4A3F60]">No sounds found</p>
          </div>
        ) : (
          <div className="divide-y divide-[#1A0A2E]">
            {samples.map((sample) => (
              <div
                key={sample.id}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#1A0A2E] transition group"
              >
                {/* Color dot + emoji */}
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm"
                  style={{ backgroundColor: sample.color + "20" }}
                >
                  {CATEGORY_EMOJIS[sample.category] || "🎵"}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="truncate text-[12px] font-semibold text-[#E0D0F0]">
                    {sample.name}
                    {!sample.is_free && tier === "free" && (
                      <Lock className="inline ml-1 h-3 w-3 text-[#B432FF]" />
                    )}
                  </p>
                  <div className="flex items-center gap-1.5 text-[10px] text-[#4A3F60]">
                    {sample.bpm && <span>{sample.bpm} BPM</span>}
                    {sample.key && <><span>·</span><span>{sample.key}</span></>}
                  </div>
                </div>

                {/* Preview + Add */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handlePreview(sample.id)}
                    className={`flex h-7 w-7 items-center justify-center rounded-full transition ${
                      playing === sample.id
                        ? "bg-[#B432FF] text-white scale-110"
                        : "bg-[#1A0A2E] text-[#8A7FA8] hover:text-[#E0D0F0] opacity-0 group-hover:opacity-100"
                    }`}
                  >
                    <Play className="h-3 w-3 ml-0.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onAddSample(sample.id)}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-[#B432FF]/10 text-[#B432FF] transition hover:bg-[#B432FF]/20 opacity-0 group-hover:opacity-100"
                    title="Add to session"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pro upsell */}
      {tier === "free" && (
        <div className="border-t border-[#2A1A4A] px-4 py-2.5 flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-[#B432FF]" />
          <span className="text-[10px] text-[#8A7FA8]">
            Upgrade to Pro for {samples.length > 0 ? "all" : "more"} sounds
          </span>
          <button
            type="button"
            className="ml-auto rounded-md bg-[#B432FF] px-2.5 py-1 text-[10px] font-bold text-white hover:bg-[#C758FF] transition"
          >
            $10/mo
          </button>
        </div>
      )}
    </div>
  );
}
