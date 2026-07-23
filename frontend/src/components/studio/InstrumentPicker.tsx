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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#07060B]/80 backdrop-blur-sm animate-fade-in">
      <div className="mx-4 w-full max-w-lg rounded-2xl border border-[#2A1A4A] bg-[#0D0A14] p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[18px] font-bold text-[#E0D0F0] flex items-center gap-2">
            <span className="text-2xl">🎵</span> What should it sound like?
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#4A3F60] hover:text-[#E0D0F0] hover:bg-[#1A0A2E] transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Subtitle for kids */}
        <p className="mb-4 text-[13px] text-[#8A7FA8]">
          Pick an instrument! Your recording will be turned into that sound.
        </p>

        {/* Instrument grid — big tappable buttons */}
        <div className="grid grid-cols-5 gap-2 mb-5">
          {INSTRUMENTS.map((inst) => (
            <button
              key={inst.id}
              type="button"
              onClick={() => onSelect(inst.id)}
              className="group flex flex-col items-center gap-1 rounded-xl border border-[#2A1A4A] bg-[#1A0A2E] px-2 py-3 transition hover:scale-105 hover:border-[#B432FF]/40 active:scale-95"
            >
              <span className="text-2xl group-hover:scale-125 transition">{inst.emoji}</span>
              <span className="text-[10px] font-semibold text-[#8A7FA8] group-hover:text-[#E0D0F0] transition leading-tight text-center">
                {inst.label}
              </span>
            </button>
          ))}
        </div>

        {/* Custom prompt — Pro only */}
        {allowCustom ? (
          <div className="border-t border-[#2A1A4A] pt-4">
            <p className="mb-2 text-[11px] font-semibold text-[#8A7FA8] flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-[#B432FF]" />
              Or describe any sound you can imagine
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="heavy metal grungy guitar with lots of reverb..."
                className="flex-1 rounded-lg border border-[#2A1A4A] bg-[#1A0A2E] px-3 py-2 text-[13px] text-[#E0D0F0] placeholder-[#4A3F60] outline-none focus:border-[#B432FF]/30"
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
                className="rounded-lg bg-[#B432FF] px-4 py-2 text-[12px] font-bold text-white transition hover:bg-[#C758FF] disabled:opacity-30"
              >
                Go!
              </button>
            </div>
          </div>
        ) : (
          <div className="border-t border-[#2A1A4A] pt-3 flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-[#B432FF]" />
            <span className="text-[11px] text-[#8A7FA8]">
              Want custom sounds? Upgrade to Pro
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
    </div>
  );
}
