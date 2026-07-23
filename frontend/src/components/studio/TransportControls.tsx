"use client";

import { Play, Square, Circle, SkipBack } from "lucide-react";

interface TransportControlsProps {
  bpm: number;
  musicalKey: string;
  scale: string;
  isPlaying: boolean;
  isRecording: boolean;
  onPlay: () => void;
  onStop: () => void;
  onRecord: () => void;
  onRewind: () => void;
  onBpmChange: (bpm: number) => void;
  onKeyChange: (key: string) => void;
}

const KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export default function TransportControls({
  bpm,
  musicalKey,
  scale,
  isPlaying,
  isRecording,
  onPlay,
  onStop,
  onRecord,
  onRewind,
  onBpmChange,
  onKeyChange,
}: TransportControlsProps) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[#2A1A4A] bg-[#0D0A14] px-4 py-2.5">
      {/* Transport buttons */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onRewind}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8A7FA8] transition hover:text-[#E0D0F0] hover:bg-[#1A0A2E]"
        >
          <SkipBack className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={isPlaying ? onStop : onPlay}
          className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
            isPlaying
              ? "bg-[#B432FF] text-white"
              : "text-[#8A7FA8] hover:text-[#E0D0F0] hover:bg-[#1A0A2E]"
          }`}
        >
          {isPlaying ? <Square className="h-3 w-3" /> : <Play className="h-3.5 w-3.5 ml-0.5" />}
        </button>

        <button
          type="button"
          onClick={onRecord}
          className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
            isRecording
              ? "bg-[#FF3388] text-white"
              : "text-[#8A7FA8] hover:text-[#FF3388] hover:bg-[#1A0A2E]"
          }`}
        >
          <Circle className={`h-3 w-3 ${isRecording ? "fill-current" : ""}`} />
        </button>
      </div>

      <span className="h-5 w-px bg-[#2A1A4A]" />

      {/* BPM */}
      <div className="flex items-center gap-1.5">
        <label className="text-[10px] font-bold uppercase tracking-widest text-[#4A3F60]">
          BPM
        </label>
        <input
          type="number"
          min={40}
          max={300}
          value={bpm}
          onChange={(e) => onBpmChange(Number(e.target.value))}
          className="w-14 rounded-md border border-[#2A1A4A] bg-[#1A0A2E] px-2 py-1 text-center text-[13px] font-mono text-[#E0D0F0] outline-none transition focus:border-[#B432FF]/40"
        />
      </div>

      <span className="h-5 w-px bg-[#2A1A4A]" />

      {/* Key */}
      <div className="flex items-center gap-1.5">
        <label className="text-[10px] font-bold uppercase tracking-widest text-[#4A3F60]">
          Key
        </label>
        <select
          value={musicalKey}
          onChange={(e) => onKeyChange(e.target.value)}
          className="rounded-md border border-[#2A1A4A] bg-[#1A0A2E] px-2 py-1 text-[13px] font-mono text-[#E0D0F0] outline-none transition focus:border-[#B432FF]/40"
        >
          {KEYS.map((k) => (
            <option key={k} value={k}>{k} {scale}</option>
          ))}
        </select>
      </div>

      {/* Recording indicator */}
      {isRecording && (
        <>
          <span className="h-5 w-px bg-[#2A1A4A]" />
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-[#FF3388] animate-pulse" />
            <span className="text-[11px] font-semibold text-[#FF3388]">REC</span>
          </div>
        </>
      )}
    </div>
  );
}
