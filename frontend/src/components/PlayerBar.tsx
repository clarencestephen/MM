"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Play, Pause, SkipBack, Volume2, VolumeX, X } from "lucide-react";

interface PlayerSong {
  id: string;
  title: string;
  genre: string | null;
  audioUrl: string;
}

function formatTime(s: number): string {
  if (!s || !isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

export default function PlayerBar() {
  const [song, setSong] = useState<PlayerSong | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  // Listen for play/pause/stop events from the page
  useEffect(() => {
    function handle(e: Event) {
      const d = (e as CustomEvent).detail;
      if (d.action === "play" && d.song) {
        const newSong = d.song as PlayerSong;

        // If same song, just resume
        if (song?.id === newSong.id && audioRef.current) {
          audioRef.current.play().catch(() => {});
          setIsPlaying(true);
          return;
        }

        // New song
        setSong(newSong);
        setIsPlaying(true);
        setCurrentTime(0);
        setDuration(0);

        if (!audioRef.current) audioRef.current = new Audio();
        const audio = audioRef.current;
        audio.src = newSong.audioUrl;
        audio.muted = muted;
        audio.play().catch(() => setIsPlaying(false));
      } else if (d.action === "pause") {
        if (audioRef.current) audioRef.current.pause();
        setIsPlaying(false);
      } else if (d.action === "stop") {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }
        setIsPlaying(false);
      }
    }
    window.addEventListener("mm:player", handle);
    return () => window.removeEventListener("mm:player", handle);
  }, [song?.id, muted]);

  // Audio event listeners
  useEffect(() => {
    if (!audioRef.current) return;
    const audio = audioRef.current;

    const onTime = () => setCurrentTime(audio.currentTime);
    const onMeta = () => setDuration(audio.duration || 0);
    const onEnd = () => {
      setIsPlaying(false);
      window.dispatchEvent(new CustomEvent("mm:player:status", { detail: { action: "stopped" } }));
    };

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnd);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnd);
    };
  }, [song?.id]);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  }, [isPlaying]);

  const seek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!barRef.current || !audioRef.current || !duration) return;
      const rect = barRef.current.getBoundingClientRect();
      audioRef.current.currentTime =
        Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * duration;
    },
    [duration]
  );

  const close = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    setSong(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    window.dispatchEvent(new CustomEvent("mm:player:status", { detail: { action: "stopped" } }));
  }, []);

  if (!song) return null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up">
      {/* Progress bar — clickable */}
      <div
        ref={barRef}
        onClick={seek}
        className="group relative h-1 cursor-pointer bg-[#1A0A2E] transition-all hover:h-1.5"
      >
        <div
          className="h-full bg-[#B432FF] transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Player content */}
      <div className="flex h-16 items-center gap-4 bg-[#050504]/95 px-4 backdrop-blur-xl sm:px-6 border-t border-[#1A0A2E]">
        {/* NOW PLAYING label + song info */}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#B432FF]/10">
            {isPlaying ? (
              <div className="flex items-end gap-[2px] h-5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="waveform-bar w-[2px] rounded-full bg-[#B432FF]" style={{ height: "3px" }} />
                ))}
              </div>
            ) : (
              <Play className="h-4 w-4 text-[#B432FF]/50 ml-0.5" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#B432FF]">
                Now Playing
              </span>
            </div>
            <p className="truncate text-[13px] font-semibold text-[#E0D0F0]">
              {song.title}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => { if (audioRef.current) audioRef.current.currentTime = 0; }}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#4A3F60] transition hover:text-[#8A7FA8]">
            <SkipBack className="h-4 w-4" />
          </button>
          <button type="button" onClick={togglePlay}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[#B432FF] text-white transition hover:bg-[#C758FF]">
            {isPlaying ? <Pause className="h-4.5 w-4.5" /> : <Play className="h-4.5 w-4.5 ml-0.5" />}
          </button>
        </div>

        {/* Time + Volume + Close */}
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline text-[11px] font-mono tabular-nums text-[#8A7FA8]">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
          <button type="button" onClick={() => { setMuted(!muted); if (audioRef.current) audioRef.current.muted = !muted; }}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#4A3F60] transition hover:text-[#8A7FA8]">
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <button type="button" onClick={close}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#4A3F60] transition hover:text-[#8A7FA8]">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
