"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, Square, RotateCcw, CheckCircle2 } from "lucide-react";

interface VoiceRecorderProps {
  onRecorded: (blob: Blob) => void;
  onCancel: () => void;
}

export default function VoiceRecorder({ onRecorded, onCancel }: VoiceRecorderProps) {
  const [state, setState] = useState<"idle" | "recording" | "done">("idle");
  const [seconds, setSeconds] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const recorded = new Blob(chunksRef.current, { type: "audio/webm" });
        setBlob(recorded);
        setState("done");
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);
      };

      recorder.start(250); // collect data every 250ms
      setState("recording");
      setSeconds(0);

      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          // Auto-stop at 30 seconds
          if (s >= 29) {
            recorder.stop();
            return 30;
          }
          return s + 1;
        });
      }, 1000);
    } catch {
      setError("Microphone access denied. Allow mic permission and try again.");
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const reset = useCallback(() => {
    setBlob(null);
    setSeconds(0);
    setState("idle");
  }, []);

  const confirm = useCallback(() => {
    if (blob) onRecorded(blob);
  }, [blob, onRecorded]);

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="rounded-xl border border-[#2A1A4A] bg-[#0D0A14] p-4">
      {error && (
        <p className="mb-3 text-[11px] text-red-400">{error}</p>
      )}

      {state === "idle" && (
        <div className="text-center">
          <p className="mb-3 text-[12px] text-[#8A7FA8]">
            Record 10–30 seconds of your voice. Read any text or rap some bars.
          </p>
          <button
            type="button"
            onClick={startRecording}
            className="inline-flex items-center gap-2 rounded-xl bg-[#FF3388] px-5 py-2.5 text-[13px] font-bold text-white transition hover:bg-[#FF4444]"
          >
            <Mic className="h-4 w-4" />
            Start Recording
          </button>
        </div>
      )}

      {state === "recording" && (
        <div className="text-center">
          {/* Pulsing red dot */}
          <div className="mx-auto mb-3 flex items-center justify-center gap-2">
            <div
              className="h-3 w-3 rounded-full bg-[#FF3388]"
              style={{ animation: "recording-pulse 1.5s ease-in-out infinite" }}
            />
            <span className="font-mono text-[20px] font-bold tabular-nums text-[#E0D0F0]">
              {formatTime(seconds)}
            </span>
          </div>
          <p className="mb-3 text-[11px] text-[#8A7FA8]">
            {seconds < 10
              ? "Keep going... need at least 10 seconds"
              : "Good! You can stop anytime."}
          </p>
          {/* Progress bar showing 0-30s */}
          <div className="mx-auto mb-4 h-1 w-48 overflow-hidden rounded-full bg-[#2A1A4A]">
            <div
              className="h-full rounded-full bg-[#FF3388] transition-all"
              style={{ width: `${Math.min(100, (seconds / 30) * 100)}%` }}
            />
          </div>
          <button
            type="button"
            onClick={stopRecording}
            disabled={seconds < 3}
            className="inline-flex items-center gap-2 rounded-xl bg-[#2A1A4A] px-5 py-2.5 text-[13px] font-bold text-[#E0D0F0] transition hover:bg-[#3D2466] disabled:opacity-30"
          >
            <Square className="h-3.5 w-3.5" />
            Stop
          </button>
        </div>
      )}

      {state === "done" && blob && (
        <div className="text-center">
          <div className="mx-auto mb-3 flex items-center justify-center gap-2 text-emerald-500">
            <CheckCircle2 className="h-5 w-5" />
            <span className="text-[13px] font-semibold">
              {formatTime(seconds)} recorded
            </span>
          </div>

          {/* Playback preview */}
          <audio
            src={URL.createObjectURL(blob)}
            controls
            className="mx-auto mb-4 h-8 w-full max-w-xs"
          />

          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#2A1A4A] px-3 py-2 text-[11px] font-medium text-[#8A7FA8] transition hover:text-[#E0D0F0]"
            >
              <RotateCcw className="h-3 w-3" />
              Re-record
            </button>
            <button
              type="button"
              onClick={confirm}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#B432FF] px-4 py-2 text-[11px] font-bold text-white transition hover:bg-[#C758FF]"
            >
              <CheckCircle2 className="h-3 w-3" />
              Use This Voice
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="text-[11px] text-[#4A3F60] transition hover:text-[#8A7FA8]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
