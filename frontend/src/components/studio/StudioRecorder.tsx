"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Circle, Square, AlertCircle } from "lucide-react";

interface StudioRecorderProps {
  onRecordingComplete: (blob: Blob, durationSeconds: number) => void;
  onCancel: () => void;
}

export default function StudioRecorder({ onRecordingComplete, onCancel }: StudioRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [analyserData, setAnalyserData] = useState<Uint8Array | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      // Analyser for live visualization
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const duration = (Date.now() - startTimeRef.current) / 1000;
        stream.getTracks().forEach((t) => t.stop());
        audioCtx.close();
        onRecordingComplete(blob, duration);
      };

      mediaRecorder.start(250);
      startTimeRef.current = Date.now();
      setRecording(true);
      setError(null);

      // Timer
      timerRef.current = setInterval(() => {
        setElapsed((Date.now() - startTimeRef.current) / 1000);
      }, 100);

      // Visualizer
      const drawVisualizer = () => {
        if (!analyserRef.current || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserRef.current.getByteFrequencyData(dataArray);

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const barWidth = (canvas.width / bufferLength) * 2.5;
        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * canvas.height;
          ctx.fillStyle = `rgba(255, 107, 53, ${dataArray[i] / 255})`;
          ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
          x += barWidth + 1;
        }

        animFrameRef.current = requestAnimationFrame(drawVisualizer);
      };
      drawVisualizer();
    } catch {
      setError("Microphone access denied. Please allow microphone access.");
    }
  }, [onRecordingComplete]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
    cancelAnimationFrame(animFrameRef.current);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="rounded-xl border border-[#1c1b18] bg-[#0a0a09] p-5">
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-900/10 px-3 py-2 text-[12px] text-red-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Visualizer */}
      <canvas
        ref={canvasRef}
        width={600}
        height={60}
        className="mb-4 w-full rounded-lg bg-[#111110]"
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {!recording ? (
            <button
              type="button"
              onClick={startRecording}
              className="flex h-10 items-center gap-2 rounded-lg bg-[#FF2D2D] px-4 text-[12px] font-bold text-white transition hover:bg-[#FF4040]"
            >
              <Circle className="h-3 w-3 fill-current" />
              Start Recording
            </button>
          ) : (
            <button
              type="button"
              onClick={stopRecording}
              className="flex h-10 items-center gap-2 rounded-lg bg-[#FF2D2D] px-4 text-[12px] font-bold text-white transition hover:bg-[#FF4040]"
            >
              <Square className="h-3 w-3" />
              Stop
            </button>
          )}

          {recording && (
            <span className="font-mono text-[14px] text-[#F0EDE8]">
              {formatTime(elapsed)}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="text-[11px] text-[#3A3632] hover:text-[#6B6560] transition"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
