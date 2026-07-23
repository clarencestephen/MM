"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  Save,
  Mic,
  Upload,
  Library,
  Download,
  Wand2,
} from "lucide-react";
import {
  getStudioSession,
  updateStudioSession,
  getTierLimits,
  addStudioTrack,
  recordTrackAudio,
  uploadTrackAudio,
} from "@/lib/api";
import type { StudioSession, TierLimits } from "@/lib/types";
import TransportControls from "@/components/studio/TransportControls";
import MultiTrackEditor from "@/components/studio/MultiTrackEditor";
import StudioRecorder from "@/components/studio/StudioRecorder";
import SampleBrowser from "@/components/studio/SampleBrowser";
import InstrumentPicker from "@/components/studio/InstrumentPicker";

const TRACK_COLORS = [
  "#8b5cf6", "#ef4444", "#f59e0b", "#10b981",
  "#3b82f6", "#ec4899", "#06b6d4", "#84cc16",
];

export default function StudioSessionPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const [session, setSession] = useState<StudioSession | null>(null);
  const [tierLimits, setTierLimits] = useState<TierLimits | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [saving, setSaving] = useState(false);

  // UX flow state
  const [showRecorder, setShowRecorder] = useState(false);
  const [showSamples, setShowSamples] = useState(false);
  const [showInstrumentPicker, setShowInstrumentPicker] = useState(false);
  const [convertTrackId, setConvertTrackId] = useState<string | null>(null);
  const [pendingTrackId, setPendingTrackId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Load session + tier
  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [s, t] = await Promise.all([
          getStudioSession(sessionId),
          getTierLimits(),
        ]);
        setSession(s);
        setTierLimits(t);
      } catch {
        setError("Session not found");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [sessionId]);

  const refreshSession = useCallback(async () => {
    const updated = await getStudioSession(sessionId);
    setSession(updated);
  }, [sessionId]);

  const showFeedback = useCallback((msg: string) => {
    setActionFeedback(msg);
    setTimeout(() => setActionFeedback(null), 2500);
  }, []);

  // --- Quick Actions ---

  // 1. One-tap record: creates track + opens recorder
  const handleQuickRecord = useCallback(async () => {
    if (!session) return;
    try {
      const color = TRACK_COLORS[session.tracks.length % TRACK_COLORS.length];
      const track = await addStudioTrack(session.id, {
        name: `Track ${session.tracks.length + 1}`,
        track_type: "recording",
        color,
      });
      setPendingTrackId(track.id);
      setShowRecorder(true);
      await refreshSession();
    } catch (err: any) {
      if (err?.status === 403) showFeedback("Upgrade to Pro for more tracks");
    }
  }, [session, refreshSession, showFeedback]);

  // 2. Recording complete → auto-open instrument picker
  const handleRecordingDone = useCallback(async (blob: Blob) => {
    if (!pendingTrackId) return;
    await recordTrackAudio(pendingTrackId, blob);
    await refreshSession();
    setShowRecorder(false);
    // Immediately ask "what should this sound like?"
    setConvertTrackId(pendingTrackId);
    setShowInstrumentPicker(true);
    setPendingTrackId(null);
  }, [pendingTrackId, refreshSession]);

  // 3. Instrument selected → convert
  const handleInstrumentSelect = useCallback(async (instrument: string) => {
    if (!convertTrackId) return;
    setShowInstrumentPicker(false);
    showFeedback(`Converting to ${instrument}...`);

    try {
      await fetch(`/api/studio/tracks/${convertTrackId}/convert?instrument_description=${encodeURIComponent(instrument)}&quality=draft`, {
        method: "POST",
      });
      await refreshSession();
      showFeedback(`Converted to ${instrument}!`);
    } catch {
      showFeedback("Conversion ready when MusicGen is installed");
    }
    setConvertTrackId(null);
  }, [convertTrackId, refreshSession, showFeedback]);

  // 4. Upload file — one-tap
  const handleQuickUpload = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "audio/*";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file || !session) return;
      try {
        const color = TRACK_COLORS[session.tracks.length % TRACK_COLORS.length];
        const track = await addStudioTrack(session.id, {
          name: file.name.replace(/\.[^.]+$/, ""),
          track_type: "import",
          color,
        });
        await uploadTrackAudio(track.id, file, file.name);
        await refreshSession();
        showFeedback("Track added!");
      } catch (err: any) {
        if (err?.status === 403) showFeedback("Upgrade to Pro for more tracks");
      }
    };
    input.click();
  }, [session, refreshSession, showFeedback]);

  // 5. Add sample from library
  const handleAddSample = useCallback(async (sampleId: string) => {
    if (!session) return;
    try {
      await fetch(`/api/studio/sessions/${session.id}/tracks/from-sample?sample_id=${sampleId}`, {
        method: "POST",
      });
      await refreshSession();
      showFeedback("Sample added!");
    } catch (err: any) {
      if (err?.status === 403) showFeedback("Upgrade to Pro for more tracks");
    }
  }, [session, refreshSession, showFeedback]);

  // 6. Export mix
  const handleExport = useCallback(async () => {
    if (!session) return;
    showFeedback("Mixing tracks...");
    try {
      const res = await fetch(`/api/studio/sessions/${session.id}/export?format=mp3`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok && data.download_path) {
        showFeedback("Mix ready! Downloading...");
        const a = document.createElement("a");
        a.href = `/api/studio/sessions/${session.id}/download?path=${encodeURIComponent(data.download_path)}`;
        a.download = `${session.title}.mp3`;
        a.click();
      } else {
        showFeedback(data.detail || "Export failed");
      }
    } catch {
      showFeedback("No audio to export yet");
    }
  }, [session, showFeedback]);

  const handleBpmChange = useCallback(async (bpm: number) => {
    if (!session) return;
    setSaving(true);
    const updated = await updateStudioSession(session.id, { bpm });
    setSession(updated);
    setSaving(false);
  }, [session]);

  const handleKeyChange = useCallback(async (key: string) => {
    if (!session) return;
    setSaving(true);
    const updated = await updateStudioSession(session.id, { key });
    setSession(updated);
    setSaving(false);
  }, [session]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#B432FF]" />
      </div>
    );
  }

  if (error || !session || !tierLimits) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-[14px] text-[#8A7FA8]">{error || "Session not found"}</p>
        <button
          type="button"
          onClick={() => router.push("/mmmm-studio")}
          className="flex items-center gap-2 text-[12px] text-[#B432FF] hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Studio
        </button>
      </div>
    );
  }

  const hasTracks = session.tracks.length > 0;
  const hasAudio = session.tracks.some(t => t.raw_audio_path || t.processed_audio_path);

  return (
    <div className="min-h-screen pb-32">
      {/* Instrument picker overlay */}
      {showInstrumentPicker && (
        <InstrumentPicker
          onSelect={handleInstrumentSelect}
          onClose={() => { setShowInstrumentPicker(false); setConvertTrackId(null); }}
          allowCustom={tierLimits.limits.custom_instrument_prompts}
        />
      )}

      {/* Action feedback toast */}
      {actionFeedback && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 rounded-xl bg-[#1A0A2E] border border-[#2A1A4A] px-5 py-2.5 text-[13px] font-semibold text-[#E0D0F0] shadow-xl animate-fade-up">
          {actionFeedback}
        </div>
      )}

      {/* Top bar */}
      <div className="sticky top-11 z-20 border-b border-[#2A1A4A] bg-[#07060B]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-5 py-2.5 sm:px-6">
          <button
            type="button"
            onClick={() => router.push("/mmmm-studio")}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8A7FA8] hover:text-[#E0D0F0] transition"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="truncate text-[15px] font-semibold text-[#E0D0F0]">
              {session.title}
            </h1>
            <div className="flex items-center gap-1.5 text-[10px] text-[#4A3F60]">
              <span>MMMM Studio</span>
              {saving && (
                <>
                  <span>·</span>
                  <span className="flex items-center gap-1 text-[#B432FF]">
                    <Save className="h-2.5 w-2.5" /> Saving...
                  </span>
                </>
              )}
            </div>
          </div>

          <TransportControls
            bpm={session.bpm}
            musicalKey={session.key}
            scale={session.scale}
            isPlaying={isPlaying}
            isRecording={showRecorder}
            onPlay={() => setIsPlaying(true)}
            onStop={() => setIsPlaying(false)}
            onRecord={handleQuickRecord}
            onRewind={() => setIsPlaying(false)}
            onBpmChange={handleBpmChange}
            onKeyChange={handleKeyChange}
          />
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-5 pt-6 sm:px-6">
        {/* Quick actions — always visible, one-tap */}
        <div className="mb-5 flex items-center gap-2">
          <button
            type="button"
            onClick={handleQuickRecord}
            className="flex items-center gap-2 rounded-xl bg-[#FF3388]/10 border border-[#FF3388]/20 px-4 py-2.5 text-[12px] font-semibold text-[#FF3388] transition hover:bg-[#FF3388]/15 active:scale-95"
          >
            <Mic className="h-4 w-4" />
            Record
          </button>

          <button
            type="button"
            onClick={handleQuickUpload}
            className="flex items-center gap-2 rounded-xl bg-[#3b82f6]/10 border border-[#3b82f6]/20 px-4 py-2.5 text-[12px] font-semibold text-[#3b82f6] transition hover:bg-[#3b82f6]/15 active:scale-95"
          >
            <Upload className="h-4 w-4" />
            Upload
          </button>

          <button
            type="button"
            onClick={() => setShowSamples(!showSamples)}
            className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[12px] font-semibold transition active:scale-95 ${
              showSamples
                ? "bg-[#f59e0b]/10 border-[#f59e0b]/20 text-[#f59e0b]"
                : "bg-[#f59e0b]/10 border-[#f59e0b]/20 text-[#f59e0b] hover:bg-[#f59e0b]/15"
            }`}
          >
            <Library className="h-4 w-4" />
            Sounds
          </button>

          {hasAudio && (
            <button
              type="button"
              onClick={handleExport}
              className="ml-auto flex items-center gap-2 rounded-xl bg-[#B432FF] px-4 py-2.5 text-[12px] font-bold text-white transition hover:bg-[#C758FF] active:scale-95"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
          )}
        </div>

        {/* Recorder — slides in when recording */}
        {showRecorder && (
          <div className="mb-5">
            <StudioRecorder
              onRecordingComplete={handleRecordingDone}
              onCancel={() => { setShowRecorder(false); setPendingTrackId(null); }}
            />
          </div>
        )}

        {/* Sample browser — slides in when toggled */}
        {showSamples && (
          <div className="mb-5">
            <SampleBrowser
              onAddSample={handleAddSample}
              tier={tierLimits.tier}
            />
          </div>
        )}

        {/* Track editor */}
        <MultiTrackEditor
          session={session}
          tierLimits={tierLimits}
          isPlaying={isPlaying}
          onSessionUpdate={setSession}
        />

        {/* Empty state — guide the user */}
        {!hasTracks && !showRecorder && !showSamples && (
          <div className="mt-8 flex flex-col items-center text-center">
            <p className="text-[15px] text-[#8A7FA8] max-w-sm leading-relaxed">
              Tap <span className="font-semibold text-[#FF3388]">Record</span> and hum, sing, tap, or beatbox.
              Then pick what instrument it should be.
              Add more layers to build your song!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
