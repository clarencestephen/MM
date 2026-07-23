"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { Play, Pause, Loader2, Share2 } from "lucide-react";

interface SongData {
  id: string;
  title: string;
  genre: string | null;
  mood: string | null;
  bpm: number | null;
  key: string | null;
}

export default function ListenPage() {
  const params = useParams();
  const songId = params.songId as string;
  const [song, setSong] = useState<SongData | null>(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [copied, setCopied] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetch(`/api/songs/${songId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then(setSong)
      .catch(() => setSong(null))
      .finally(() => setLoading(false));
  }, [songId]);

  const togglePlay = () => {
    if (!audioRef.current) {
      const audio = new Audio(`/api/songs/${songId}/audio`);
      audio.addEventListener("timeupdate", () => setCurrentTime(audio.currentTime));
      audio.addEventListener("loadedmetadata", () => setDuration(audio.duration));
      audio.addEventListener("ended", () => setPlaying(false));
      audioRef.current = audio;
    }

    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setPlaying(!playing);
  };

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07060B]">
        <Loader2 className="h-6 w-6 animate-spin text-[#B432FF]" />
      </div>
    );
  }

  if (!song) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#07060B]">
        <p className="text-[16px] text-[#8A7FA8]">Song not found</p>
        <p className="mt-2 text-[12px] text-[#4A3F60]">This link may have expired or the song was removed</p>
      </div>
    );
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#07060B] px-5">
      <div className="w-full max-w-sm text-center">
        {/* MM branding */}
        <div className="mb-8">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-[#B432FF]">
            <span className="text-sm font-black text-white">M</span>
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#4A3F60]">
            Made with MM
          </span>
        </div>

        {/* Song info */}
        <h1 className="font-display text-[28px] font-light italic text-[#E0D0F0] mb-2">
          {song.title}
        </h1>
        <div className="flex items-center justify-center gap-2 text-[12px] text-[#8A7FA8] mb-8">
          {song.genre && <span>{song.genre.replace("_", " ")}</span>}
          {song.bpm && <><span className="text-[#4A3F60]">·</span><span>{song.bpm} BPM</span></>}
          {song.key && <><span className="text-[#4A3F60]">·</span><span>Key of {song.key}</span></>}
        </div>

        {/* Player */}
        <div className="rounded-2xl border border-[#2A1A4A] bg-[#0D0A14] p-8">
          <button
            type="button"
            onClick={togglePlay}
            className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full transition-all active:scale-95 ${
              playing
                ? "bg-[#B432FF] text-white scale-105 shadow-lg shadow-[#B432FF]/20"
                : "bg-[#B432FF] text-white hover:scale-110 hover:shadow-lg hover:shadow-[#B432FF]/20"
            }`}
          >
            {playing ? (
              <Pause className="h-6 w-6" />
            ) : (
              <Play className="h-6 w-6 ml-1" />
            )}
          </button>

          {/* Progress bar */}
          <div className="mt-6">
            <div className="h-1 w-full rounded-full bg-[#2A1A4A] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#B432FF] transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between text-[10px] font-mono text-[#4A3F60]">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        </div>

        {/* Share */}
        <button
          type="button"
          onClick={handleShare}
          className="mt-6 inline-flex items-center gap-2 rounded-lg border border-[#2A1A4A] bg-[#0D0A14] px-4 py-2.5 text-[12px] font-medium text-[#8A7FA8] transition hover:text-[#E0D0F0]"
        >
          <Share2 className="h-3.5 w-3.5" />
          {copied ? "Link copied!" : "Share this song"}
        </button>

        {/* CTA */}
        <div className="mt-8 rounded-xl border border-[#B432FF]/20 bg-[#B432FF]/[0.04] px-5 py-4">
          <p className="text-[13px] font-semibold text-[#E0D0F0]">Make your own music</p>
          <p className="mt-1 text-[11px] text-[#8A7FA8]">
            Hum, tap, or sing — AI turns your sounds into instruments
          </p>
          <a
            href="/signup"
            className="mt-3 inline-block rounded-lg bg-[#B432FF] px-5 py-2 text-[12px] font-bold text-white transition hover:bg-[#C758FF]"
          >
            Sign Up Free
          </a>
        </div>
      </div>
    </div>
  );
}
