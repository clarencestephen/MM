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
    <div className="flex items-center gap-3 rounded-xl border border-[#1c1b18] bg-[#0a0a09] px-4 py-2.5">
      {/* Transport buttons */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onRewind}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[#6B6560] transition hover:text-[#F0EDE8] hover:bg-[#111110]"
        >
          <SkipBack className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={isPlaying ? onStop : onPlay}
          className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
            isPlaying
              ? "bg-[#FF6B35] text-black"
              : "text-[#6B6560] hover:text-[#F0EDE8] hover:bg-[#111110]"
          }`}
        >
          {isPlaying ? <Square className="h-3 w-3" /> : <Play className="h-3.5 w-3.5 ml-0.5" />}
        </button>

        <button
          type="button"
          onClick={onRecord}
          className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
            isRecording
              ? "bg-[#FF2D2D] text-white"
              : "text-[#6B6560] hover:text-[#FF2D2D] hover:bg-[#111110]"
          }`}
        >
          <Circle className={`h-3 w-3 ${isRecording ? "fill-current" : ""}`} />
        </button>
      </div>

      <span className="h-5 w-px bg-[#1c1b18]" />

      {/* BPM */}
      <div className="flex items-center gap-1.5">
        <label className="text-[10px] font-bold uppercase tracking-widest text-[#3A3632]">
          BPM
        </label>
        <input
          type="number"
          min={40}
          max={300}
          value={bpm}
          onChange={(e) => onBpmChange(Number(e.target.value))}
          className="w-14 rounded-md border border-[#1c1b18] bg-[#111110] px-2 py-1 text-center text-[13px] font-mono text-[#F0EDE8] outline-none transition focus:border-[#FF6B35]/40"
        />
      </div>

      <span className="h-5 w-px bg-[#1c1b18]" />

      {/* Key */}
      <div className="flex items-center gap-1.5">
        <label className="text-[10px] font-bold uppercase tracking-widest text-[#3A3632]">
          Key
        </label>
        <select
          value={musicalKey}
          onChange={(e) => onKeyChange(e.target.value)}
          className="rounded-md border border-[#1c1b18] bg-[#111110] px-2 py-1 text-[13px] font-mono text-[#F0EDE8] outline-none transition focus:border-[#FF6B35]/40"
        >
          {KEYS.map((k) => (
            <option key={k} value={k}>{k} {scale}</option>
          ))}
        </select>
      </div>

      {/* Recording indicator */}
      {isRecording && (
        <>
          <span className="h-5 w-px bg-[#1c1b18]" />
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-[#FF2D2D] animate-pulse" />
            <span className="text-[11px] font-semibold text-[#FF2D2D]">REC</span>
          </div>
        </>
      )}
    </div>
  );
}
