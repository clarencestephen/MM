'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { Play, Pause, Loader2, Volume2 } from 'lucide-react';

interface WaveformPlayerProps {
  audioUrl: string | null;
  height?: number;
  color?: string;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function WaveformPlayer({
  audioUrl,
  height = 80,
  color = '#8b5cf6',
}: WaveformPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<ReturnType<typeof Object.create> | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isReady, setIsReady] = useState(false);

  const destroyInstance = useCallback(() => {
    if (wavesurferRef.current) {
      try {
        wavesurferRef.current.destroy();
      } catch {
        // ignore cleanup errors
      }
      wavesurferRef.current = null;
    }
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setIsReady(false);
  }, []);

  useEffect(() => {
    if (!audioUrl || !containerRef.current) {
      destroyInstance();
      return;
    }

    let cancelled = false;

    async function init() {
      if (!containerRef.current) return;

      destroyInstance();
      setIsLoading(true);

      const WaveSurfer = (await import('wavesurfer.js')).default;

      if (cancelled || !containerRef.current) return;

      const ws = WaveSurfer.create({
        container: containerRef.current,
        height,
        waveColor: color,
        progressColor: '#c4b5fd',
        cursorColor: '#a78bfa',
        cursorWidth: 2,
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        normalize: true,
        backend: 'WebAudio',
        url: audioUrl!,
      });

      wavesurferRef.current = ws;

      ws.on('ready', () => {
        if (cancelled) return;
        setIsLoading(false);
        setIsReady(true);
        setDuration(ws.getDuration());
      });

      ws.on('audioprocess', () => {
        if (cancelled) return;
        setCurrentTime(ws.getCurrentTime());
      });

      ws.on('seeking', () => {
        if (cancelled) return;
        setCurrentTime(ws.getCurrentTime());
      });

      ws.on('play', () => {
        if (cancelled) return;
        setIsPlaying(true);
      });

      ws.on('pause', () => {
        if (cancelled) return;
        setIsPlaying(false);
      });

      ws.on('finish', () => {
        if (cancelled) return;
        setIsPlaying(false);
      });

      ws.on('error', () => {
        if (cancelled) return;
        setIsLoading(false);
      });
    }

    init();

    return () => {
      cancelled = true;
      destroyInstance();
    };
  }, [audioUrl, height, color, destroyInstance]);

  const togglePlay = useCallback(() => {
    if (!wavesurferRef.current || !isReady) return;
    wavesurferRef.current.playPause();
  }, [isReady]);

  if (!audioUrl) {
    return (
      <div
        className="flex items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800"
        style={{ height: height + 40 }}
      >
        <div className="flex flex-col items-center gap-2 text-zinc-500">
          <Volume2 className="w-8 h-8" />
          <span className="text-sm">No audio loaded</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4">
      {/* Waveform Container */}
      <div className="relative mb-3">
        <div
          ref={containerRef}
          className="w-full rounded-lg overflow-hidden"
          style={{ minHeight: height }}
        />
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/80 rounded-lg">
            <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
            <span className="ml-2 text-sm text-zinc-400">Loading audio...</span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        <button
          onClick={togglePlay}
          disabled={!isReady}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white transition-colors duration-200"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause className="w-5 h-5" />
          ) : (
            <Play className="w-5 h-5 ml-0.5" />
          )}
        </button>

        <div className="flex items-center gap-2 text-sm font-mono text-zinc-400">
          <span>{formatTime(currentTime)}</span>
          <span className="text-zinc-600">/</span>
          <span>{formatTime(duration)}</span>
        </div>

        {/* Progress bar (visual indicator) */}
        <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-violet-500 rounded-full transition-all duration-100"
            style={{
              width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%',
            }}
          />
        </div>
      </div>
    </div>
  );
}
