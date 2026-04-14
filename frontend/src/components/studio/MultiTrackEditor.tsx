"use client";

import { useState, useCallback } from "react";
import { Plus, Upload, Mic, Music } from "lucide-react";
import type {
  StudioSession,
  StudioTrack,
  UpdateStudioTrackRequest,
  TierLimits,
} from "@/lib/types";
import {
  addStudioTrack,
  updateStudioTrack,
  deleteStudioTrack,
  uploadTrackAudio,
  recordTrackAudio,
  getTrackAudioUrl,
} from "@/lib/api";
import TrackLane from "./TrackLane";
import StudioRecorder from "./StudioRecorder";
import UpgradePrompt from "./UpgradePrompt";

const TRACK_COLORS = [
  "#8b5cf6", "#ef4444", "#f59e0b", "#10b981",
  "#3b82f6", "#ec4899", "#06b6d4", "#84cc16",
];

interface MultiTrackEditorProps {
  session: StudioSession;
  tierLimits: TierLimits;
  isPlaying: boolean;
  onSessionUpdate: (session: StudioSession) => void;
}

export default function MultiTrackEditor({
  session,
  tierLimits,
  isPlaying,
  onSessionUpdate,
}: MultiTrackEditorProps) {
  const [showRecorder, setShowRecorder] = useState(false);
  const [pendingTrackId, setPendingTrackId] = useState<string | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showUpgradeFor, setShowUpgradeFor] = useState<string | null>(null);

  const tracks = session.tracks;
  const maxTracks = tierLimits.limits.max_tracks;
  const atLimit = tracks.length >= maxTracks;

  const refreshSession = useCallback(async () => {
    const { getStudioSession } = await import("@/lib/api");
    const updated = await getStudioSession(session.id);
    onSessionUpdate(updated);
  }, [session.id, onSessionUpdate]);

  // --- Add Track ---
  const handleAddTrack = useCallback(async (type: "recording" | "import") => {
    if (atLimit && tierLimits.tier === "free") {
      setShowUpgradeFor("unlimited tracks");
      setShowAddMenu(false);
      return;
    }
    try {
      const color = TRACK_COLORS[tracks.length % TRACK_COLORS.length];
      const track = await addStudioTrack(session.id, {
        name: `Track ${tracks.length + 1}`,
        track_type: type,
        color,
      });

      if (type === "recording") {
        setPendingTrackId(track.id);
        setShowRecorder(true);
      }
      // For import, we'll trigger file upload after track creation
      if (type === "import") {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "audio/*";
        input.onchange = async (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (file) {
            await uploadTrackAudio(track.id, file, file.name);
            await refreshSession();
          }
        };
        input.click();
      }
      await refreshSession();
    } catch (err: any) {
      if (err?.status === 403) {
        setShowUpgradeFor("unlimited tracks");
      }
    }
    setShowAddMenu(false);
  }, [session.id, tracks.length, atLimit, tierLimits.tier, refreshSession]);

  // --- Recording Complete ---
  const handleRecordingComplete = useCallback(async (blob: Blob) => {
    if (!pendingTrackId) return;
    try {
      await recordTrackAudio(pendingTrackId, blob);
      await refreshSession();
    } catch {
      // handle error
    }
    setShowRecorder(false);
    setPendingTrackId(null);
  }, [pendingTrackId, refreshSession]);

  // --- Track Update ---
  const handleTrackUpdate = useCallback(async (trackId: string, data: UpdateStudioTrackRequest) => {
    await updateStudioTrack(trackId, data);
    await refreshSession();
  }, [refreshSession]);

  // --- Track Delete ---
  const handleTrackDelete = useCallback(async (trackId: string) => {
    await deleteStudioTrack(trackId);
    await refreshSession();
  }, [refreshSession]);

  // --- Track Convert (placeholder for Phase 4) ---
  const handleTrackConvert = useCallback((_trackId: string) => {
    if (!tierLimits.limits.custom_instrument_prompts && tierLimits.tier === "free") {
      setShowUpgradeFor("AI instrument conversion");
    }
    // Phase 4: will open InstrumentPicker
  }, [tierLimits]);

  return (
    <div className="space-y-3">
      {/* Upgrade prompt */}
      {showUpgradeFor && (
        <UpgradePrompt
          feature={showUpgradeFor}
          message={`${showUpgradeFor} is a Pro feature. Upgrade to unlock unlimited creative power.`}
          onDismiss={() => setShowUpgradeFor(null)}
        />
      )}

      {/* Track lanes */}
      {tracks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#1c1b18] bg-[#0a0a09] py-16">
          <Music className="mb-3 h-8 w-8 text-[#1c1b18]" />
          <p className="text-[13px] text-[#3A3632]">No tracks yet</p>
          <p className="mt-1 text-[11px] text-[#231F1C]">
            Record your voice, upload audio, or connect a MIDI controller
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {tracks.map((track) => (
            <TrackLane
              key={track.id}
              track={track}
              isPlaying={isPlaying}
              onUpdate={handleTrackUpdate}
              onDelete={handleTrackDelete}
              onConvert={handleTrackConvert}
              audioUrl={
                track.processed_audio_path || track.raw_audio_path
                  ? getTrackAudioUrl(track.id)
                  : null
              }
            />
          ))}
        </div>
      )}

      {/* Recorder overlay */}
      {showRecorder && (
        <StudioRecorder
          onRecordingComplete={handleRecordingComplete}
          onCancel={() => {
            setShowRecorder(false);
            setPendingTrackId(null);
          }}
        />
      )}

      {/* Add Track button */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowAddMenu(!showAddMenu)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#1c1b18] bg-[#0a0a09] py-3 text-[12px] font-medium text-[#3A3632] transition hover:border-[#FF6B35]/30 hover:text-[#FF6B35]"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Track
          {atLimit && tierLimits.tier === "free" && (
            <span className="ml-1 rounded-md bg-[#FF6B35]/10 px-1.5 py-0.5 text-[9px] font-bold text-[#FF6B35]">
              PRO
            </span>
          )}
        </button>

        {/* Dropdown menu */}
        {showAddMenu && (
          <div className="absolute top-full left-0 right-0 z-10 mt-1 rounded-xl border border-[#1c1b18] bg-[#0a0a09] p-1 shadow-xl">
            <button
              type="button"
              onClick={() => handleAddTrack("recording")}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-[12px] text-[#6B6560] transition hover:bg-[#111110] hover:text-[#F0EDE8]"
            >
              <Mic className="h-3.5 w-3.5 text-[#FF2D2D]" />
              Record audio
              <span className="ml-auto text-[10px] text-[#3A3632]">Mic input</span>
            </button>
            <button
              type="button"
              onClick={() => handleAddTrack("import")}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-[12px] text-[#6B6560] transition hover:bg-[#111110] hover:text-[#F0EDE8]"
            >
              <Upload className="h-3.5 w-3.5 text-[#3b82f6]" />
              Upload file
              <span className="ml-auto text-[10px] text-[#3A3632]">WAV, MP3, etc.</span>
            </button>
          </div>
        )}
      </div>

      {/* Track count */}
      <div className="flex items-center justify-between text-[10px] text-[#3A3632]">
        <span>{tracks.length} / {maxTracks === 999 ? "∞" : maxTracks} tracks</span>
        {tierLimits.tier === "free" && (
          <span className="text-[#FF6B35]">Free plan — upgrade for more</span>
        )}
      </div>
    </div>
  );
}
