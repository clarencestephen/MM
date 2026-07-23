"use client";

import { useEffect, useRef, useState } from "react";
import {
  Volume2,
  VolumeX,
  Headphones,
  Trash2,
  GripVertical,
  Wand2,
} from "lucide-react";
import type { StudioTrack, UpdateStudioTrackRequest } from "@/lib/types";

interface TrackLaneProps {
  track: StudioTrack;
  isPlaying: boolean;
  onUpdate: (trackId: string, data: UpdateStudioTrackRequest) => void;
  onDelete: (trackId: string) => void;
  onConvert: (trackId: string) => void;
  audioUrl: string | null;
}

export default function TrackLane({
  track,
  isPlaying,
  onUpdate,
  onDelete,
  onConvert,
  audioUrl,
}: TrackLaneProps) {
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<any>(null);
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState(track.name);

  // Waveform rendering
  useEffect(() => {
    if (!waveformRef.current || !audioUrl) return;

    let ws: any;
    const init = async () => {
      const WaveSurfer = (await import("wavesurfer.js")).default;
      ws = WaveSurfer.create({
        container: waveformRef.current!,
        waveColor: track.color + "60",
        progressColor: track.color,
        cursorColor: "#B432FF",
        height: 40,
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        normalize: true,
        interact: true,
        backend: "WebAudio",
      });
      ws.load(audioUrl);
      wavesurferRef.current = ws;
    };
    init();

    return () => {
      ws?.destroy();
    };
  }, [audioUrl, track.color]);

  // Play/pause sync
  useEffect(() => {
    if (!wavesurferRef.current) return;
    if (isPlaying && !track.muted) {
      wavesurferRef.current.play();
    } else {
      wavesurferRef.current.pause();
    }
  }, [isPlaying, track.muted]);

  // Volume sync
  useEffect(() => {
    if (!wavesurferRef.current) return;
    // Convert dB to linear (0 dB = 1.0, -6 dB ≈ 0.5)
    const linear = Math.pow(10, track.volume / 20);
    wavesurferRef.current.setVolume(Math.min(linear, 1));
  }, [track.volume]);

  const handleNameSubmit = () => {
    setEditing(false);
    if (nameInput.trim() && nameInput !== track.name) {
      onUpdate(track.id, { name: nameInput.trim() });
    }
  };

  const hasAudio = !!track.raw_audio_path || !!track.processed_audio_path;

  return (
    <div
      className="group flex items-center gap-2 rounded-lg border border-[#2A1A4A] bg-[#0D0A14] px-3 py-2 transition hover:border-[#3D2466]"
      style={{ borderLeftColor: track.color, borderLeftWidth: 3 }}
    >
      {/* Drag handle */}
      <div className="cursor-grab text-[#2D2640] hover:text-[#4A3F60] active:cursor-grabbing">
        <GripVertical className="h-3.5 w-3.5" />
      </div>

      {/* Track name */}
      <div className="w-28 shrink-0">
        {editing ? (
          <input
            autoFocus
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onBlur={handleNameSubmit}
            onKeyDown={(e) => e.key === "Enter" && handleNameSubmit()}
            className="w-full rounded-md bg-[#1A0A2E] px-2 py-0.5 text-[12px] text-[#E0D0F0] outline-none border border-[#B432FF]/30"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="w-full truncate text-left text-[12px] font-semibold text-[#E0D0F0] hover:text-[#B432FF] transition"
          >
            {track.name}
          </button>
        )}
        {track.instrument_label && (
          <span className="text-[10px] text-[#4A3F60]">{track.instrument_label}</span>
        )}
      </div>

      {/* Waveform */}
      <div className="flex-1 min-w-0">
        {hasAudio ? (
          <div ref={waveformRef} className="h-10" />
        ) : (
          <div className="flex h-10 items-center justify-center rounded-md border border-dashed border-[#2A1A4A]">
            <span className="text-[10px] text-[#4A3F60]">No audio — record or upload</span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Volume */}
        <input
          type="range"
          min={-24}
          max={6}
          step={0.5}
          value={track.volume}
          onChange={(e) => onUpdate(track.id, { volume: Number(e.target.value) })}
          className="h-1 w-16 accent-[#B432FF] cursor-pointer"
          title={`Volume: ${track.volume} dB`}
        />

        {/* Mute */}
        <button
          type="button"
          onClick={() => onUpdate(track.id, { muted: !track.muted })}
          className={`flex h-7 w-7 items-center justify-center rounded-md transition ${
            track.muted
              ? "bg-[#B432FF]/10 text-[#B432FF]"
              : "text-[#4A3F60] hover:text-[#8A7FA8]"
          }`}
          title={track.muted ? "Unmute" : "Mute"}
        >
          {track.muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
        </button>

        {/* Solo */}
        <button
          type="button"
          onClick={() => onUpdate(track.id, { solo: !track.solo })}
          className={`flex h-7 w-7 items-center justify-center rounded-md text-[10px] font-bold transition ${
            track.solo
              ? "bg-amber-500/10 text-amber-500"
              : "text-[#4A3F60] hover:text-[#8A7FA8]"
          }`}
          title={track.solo ? "Unsolo" : "Solo"}
        >
          <Headphones className="h-3.5 w-3.5" />
        </button>

        {/* Convert to instrument */}
        {hasAudio && !track.processed_audio_path && (
          <button
            type="button"
            onClick={() => onConvert(track.id)}
            className="flex h-7 items-center gap-1 rounded-md bg-[#1A0A2E] border border-[#2A1A4A] px-2 text-[10px] font-medium text-[#8A7FA8] transition hover:border-[#B432FF]/30 hover:text-[#B432FF]"
            title="Convert to instrument"
          >
            <Wand2 className="h-3 w-3" />
            Convert
          </button>
        )}

        {/* Delete */}
        <button
          type="button"
          onClick={() => onDelete(track.id)}
          className="flex h-7 w-7 items-center justify-center rounded-md text-[#2D2640] transition hover:text-red-500 opacity-0 group-hover:opacity-100"
          title="Delete track"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
