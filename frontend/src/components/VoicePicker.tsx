"use client";

import { useState, useEffect, useCallback } from "react";
import { Mic, Cloud, Radio, ChevronDown, Check } from "lucide-react";
import VoiceRecorder from "./VoiceRecorder";

// ─── Types ──────────────────────────────────────────────────────────────────

interface AzureVoice {
  key: string;
  id: string;
  name: string;
  gender: string;
  desc: string;
}

interface VoiceEngine {
  engine: string;
  name: string;
  description: string;
  available: boolean;
  voices: AzureVoice[];
}

export interface VoiceSelection {
  engine: "xtts" | "azure" | "recorded";
  azureVoice?: string;
  voiceClipPath?: string;
}

interface VoicePickerProps {
  value: VoiceSelection;
  onChange: (v: VoiceSelection) => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function VoicePicker({ value, onChange }: VoicePickerProps) {
  const [expanded, setExpanded] = useState(false);
  const [engines, setEngines] = useState<VoiceEngine[]>([]);
  const [loading, setLoading] = useState(false);
  const [showRecorder, setShowRecorder] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [recordedLabel, setRecordedLabel] = useState<string | null>(null);

  // Fetch available engines on first expand
  useEffect(() => {
    if (expanded && engines.length === 0 && !loading) {
      setLoading(true);
      fetch("/api/generate/voices")
        .then((r) => r.json())
        .then((d) => setEngines(d.engines || []))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [expanded, engines.length, loading]);

  const azureEngine = engines.find((e) => e.engine === "azure");
  const azureVoices = azureEngine?.voices || [];
  const azureAvailable = azureEngine?.available ?? false;

  // Get display label for current selection
  const getLabel = (): string => {
    if (value.engine === "azure" && value.azureVoice) {
      const voice = azureVoices.find((v) => v.key === value.azureVoice);
      return voice ? `${voice.name} (Azure)` : "Azure Voice";
    }
    if (value.engine === "recorded") {
      return recordedLabel || "My Voice";
    }
    return "Default Voice";
  };

  // Handle voice recording completion
  const handleRecorded = useCallback(
    async (blob: Blob) => {
      setUploading(true);
      try {
        const form = new FormData();
        form.append("file", blob, "voice_recording.webm");
        const res = await fetch("/api/upload/voice-clip", {
          method: "POST",
          body: form,
        });
        if (!res.ok) throw new Error("Upload failed");
        const data = await res.json();
        onChange({
          engine: "recorded",
          voiceClipPath: data.voice_clip_path,
        });
        setRecordedLabel("Recorded voice");
        setShowRecorder(false);
      } catch {
        // silent
      } finally {
        setUploading(false);
      }
    },
    [onChange]
  );

  return (
    <div className="relative">
      {/* Collapsed: show current voice as a button */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-[11px] font-medium transition ${
          value.engine !== "xtts"
            ? "bg-[#FF6B35]/10 text-[#FF6B35]"
            : "text-[#6B6560] hover:text-[#F0EDE8]"
        }`}
      >
        {value.engine === "azure" ? (
          <Cloud className="h-3 w-3" />
        ) : value.engine === "recorded" ? (
          <Radio className="h-3 w-3" />
        ) : (
          <Mic className="h-3 w-3" />
        )}
        {getLabel()}
        <ChevronDown
          className={`h-3 w-3 transition ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {/* Expanded: voice selection panel */}
      {expanded && (
        <div className="mt-2 w-full max-w-md rounded-xl border border-[#1c1b18] bg-[#0a0a09] p-3 shadow-xl animate-fade-in">
          {loading ? (
            <p className="py-4 text-center text-[11px] text-[#3A3632]">
              Loading voices...
            </p>
          ) : (
            <div className="space-y-1.5">
              {/* Option 1: Default XTTS */}
              <button
                type="button"
                onClick={() => {
                  onChange({ engine: "xtts" });
                  setExpanded(false);
                }}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${
                  value.engine === "xtts"
                    ? "bg-[#FF6B35]/10 border border-[#FF6B35]/20"
                    : "hover:bg-[#111110] border border-transparent"
                }`}
              >
                <Mic className="h-4 w-4 shrink-0 text-[#6B6560]" />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-[#F0EDE8]">
                    Default Voice
                  </p>
                  <p className="text-[10px] text-[#3A3632]">
                    XTTS v2 — runs locally on your GPU
                  </p>
                </div>
                {value.engine === "xtts" && (
                  <Check className="h-4 w-4 shrink-0 text-[#FF6B35]" />
                )}
              </button>

              {/* Option 2: Azure Cloud Voice */}
              {azureAvailable && (
                <div
                  className={`rounded-lg border transition ${
                    value.engine === "azure"
                      ? "bg-[#FF6B35]/10 border-[#FF6B35]/20"
                      : "border-transparent hover:bg-[#111110]"
                  }`}
                >
                  <div className="flex items-center gap-3 px-3 py-2.5">
                    <Cloud className="h-4 w-4 shrink-0 text-[#6B6560]" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-[#F0EDE8]">
                        Cloud Voice
                      </p>
                      <p className="text-[10px] text-[#3A3632]">
                        Azure Neural TTS — high quality
                      </p>
                    </div>
                    {value.engine === "azure" && (
                      <Check className="h-4 w-4 shrink-0 text-[#FF6B35]" />
                    )}
                  </div>

                  {/* Voice grid */}
                  <div className="grid grid-cols-2 gap-1 px-3 pb-3">
                    {azureVoices.map((v) => (
                      <button
                        key={v.key}
                        type="button"
                        onClick={() => {
                          onChange({ engine: "azure", azureVoice: v.key });
                          setExpanded(false);
                        }}
                        className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-left transition ${
                          value.engine === "azure" &&
                          value.azureVoice === v.key
                            ? "bg-[#FF6B35]/15 ring-1 ring-[#FF6B35]/30"
                            : "bg-[#111110] hover:bg-[#191816]"
                        }`}
                      >
                        <span
                          className={`text-[10px] ${
                            v.gender === "male"
                              ? "text-blue-400"
                              : "text-pink-400"
                          }`}
                        >
                          {v.gender === "male" ? "♂" : "♀"}
                        </span>
                        <div>
                          <p className="text-[11px] font-semibold text-[#F0EDE8]">
                            {v.name}
                          </p>
                          <p className="text-[9px] text-[#3A3632]">
                            {v.desc}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Option 3: Record My Voice */}
              <div
                className={`rounded-lg border transition ${
                  value.engine === "recorded"
                    ? "bg-[#FF6B35]/10 border-[#FF6B35]/20"
                    : "border-transparent"
                }`}
              >
                {!showRecorder ? (
                  <button
                    type="button"
                    onClick={() => setShowRecorder(true)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-[#111110]"
                  >
                    <Radio className="h-4 w-4 shrink-0 text-[#6B6560]" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-[#F0EDE8]">
                        Record My Voice
                      </p>
                      <p className="text-[10px] text-[#3A3632]">
                        10–30s clip for voice cloning
                      </p>
                    </div>
                    {value.engine === "recorded" && (
                      <Check className="h-4 w-4 shrink-0 text-[#FF6B35]" />
                    )}
                  </button>
                ) : (
                  <div className="p-2">
                    {uploading ? (
                      <p className="py-4 text-center text-[11px] text-[#6B6560]">
                        Uploading voice clip...
                      </p>
                    ) : (
                      <VoiceRecorder
                        onRecorded={handleRecorded}
                        onCancel={() => setShowRecorder(false)}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
