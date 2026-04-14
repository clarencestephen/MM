"use client";

import { useState } from "react";
import { Sparkles, X } from "lucide-react";

interface InstrumentPickerProps {
  onSelect: (instrument: string) => void;
  onClose: () => void;
  allowCustom: boolean;
}

const INSTRUMENTS = [
  { id: "drums", label: "Drums", emoji: "🥁", color: "#ef4444" },
  { id: "snare", label: "Snare", emoji: "🪘", color: "#f97316" },
  { id: "hi-hat", label: "Hi-Hat", emoji: "🔔", color: "#eab308" },
  { id: "clap", label: "Clap", emoji: "👏", color: "#a855f7" },
  { id: "bass", label: "Bass", emoji: "🔊", color: "#8b5cf6" },
  { id: "electric guitar", label: "Electric Guitar", emoji: "🎸", color: "#10b981" },
  { id: "acoustic guitar", label: "Acoustic Guitar", emoji: "🪕", color: "#22c55e" },
  { id: "piano", label: "Piano", emoji: "🎹", color: "#3b82f6" },
  { id: "synth", label: "Synth", emoji: "🎛️", color: "#06b6d4" },
  { id: "strings", label: "Strings", emoji: "🎻", color: "#ec4899" },
  { id: "choir", label: "Choir", emoji: "🎤", color: "#f43f5e" },
  { id: "trumpet", label: "Trumpet", emoji: "🎺", color: "#f59e0b" },
  { id: "saxophone", label: "Saxophone", emoji: "🎷", color: "#d97706" },
  { id: "flute", label: "Flute", emoji: "🪈", color: "#14b8a6" },
  { id: "organ", label: "Organ", emoji: "⛪", color: "#6366f1" },
];

export default function InstrumentPicker({ onSelect, onClose, allowCustom }: InstrumentPickerProps) {
  const [customPrompt, setCustomPrompt] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="mx-4 w-full max-w-lg rounded-2xl border border-[#1c1b18] bg-[#0a0a09] p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[18px] font-bold text-[#F0EDE8] flex items-center gap-2">
            <span className="text-2xl">🎵</span> What should it sound like?
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#3A3632] hover:text-[#F0EDE8] hover:bg-[#111110] transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Subtitle for kids */}
        <p className="mb-4 text-[13px] text-[#6B6560]">
          Pick an instrument! Your recording will be turned into that sound.
        </p>

        {/* Instrument grid — big tappable buttons */}
        <div className="grid grid-cols-5 gap-2 mb-5">
          {INSTRUMENTS.map((inst) => (
            <button
              key={inst.id}
              type="button"
              onClick={() => onSelect(inst.id)}
              className="group flex flex-col items-center gap-1 rounded-xl border border-[#1c1b18] bg-[#111110] px-2 py-3 transition hover:scale-105 hover:border-[#FF6B35]/40 active:scale-95"
            >
              <span className="text-2xl group-hover:scale-125 transition">{inst.emoji}</span>
              <span className="text-[10px] font-semibold text-[#6B6560] group-hover:text-[#F0EDE8] transition leading-tight text-center">
                {inst.label}
              </span>
            </button>
          ))}
        </div>

        {/* Custom prompt — Pro only */}
        {allowCustom ? (
          <div className="border-t border-[#1c1b18] pt-4">
            <p className="mb-2 text-[11px] font-semibold text-[#6B6560] flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-[#FF6B35]" />
              Or describe any sound you can imagine
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="heavy metal grungy guitar with lots of reverb..."
                className="flex-1 rounded-lg border border-[#1c1b18] bg-[#111110] px-3 py-2 text-[13px] text-[#F0EDE8] placeholder-[#3A3632] outline-none focus:border-[#FF6B35]/30"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && customPrompt.trim()) {
                    onSelect(customPrompt.trim());
                  }
                }}
              />
              <button
                type="button"
                disabled={!customPrompt.trim()}
                onClick={() => onSelect(customPrompt.trim())}
                className="rounded-lg bg-[#FF6B35] px-4 py-2 text-[12px] font-bold text-black transition hover:bg-[#FF8555] disabled:opacity-30"
              >
                Go!
              </button>
            </div>
          </div>
        ) : (
          <div className="border-t border-[#1c1b18] pt-3 flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-[#FF6B35]" />
            <span className="text-[11px] text-[#6B6560]">
              Want custom sounds? Upgrade to Pro
            </span>
            <button
              type="button"
              className="ml-auto rounded-md bg-[#FF6B35] px-2.5 py-1 text-[10px] font-bold text-black hover:bg-[#FF8555] transition"
            >
              $10/mo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
