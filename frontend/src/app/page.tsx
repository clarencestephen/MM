"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Play,
  Pause,
  Music,
  Zap,
  ArrowRight,
  Mic,
  Download,
  Trash2,
  ExternalLink,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Volume2,
} from "lucide-react";
import {
  listProjects,
  listSongsByProject,
  createProject,
  createSong,
  generateLyrics,
  generateSong,
  uploadBeat,
  getRenderJobStatus,
  deleteSong,
  getSongAudioUrl,
  exportSong,
  getExportDownloadUrl,
} from "@/lib/api";
import type { Song, Genre, Quality } from "@/lib/types";
import VoicePicker from "@/components/VoicePicker";
import type { VoiceSelection } from "@/components/VoicePicker";

// ─── Constants ──────────────────────────────────────────────────────────────

const GENRES: { value: Genre; label: string }[] = [
  { value: "hip_hop", label: "Hip Hop" },
  { value: "melodic_rap", label: "Melodic" },
  { value: "rnb", label: "R&B" },
  { value: "lofi", label: "Lo-Fi" },
];

const MOODS = [
  { value: "dark", label: "Dark" },
  { value: "hype", label: "Hype" },
  { value: "emotional", label: "Emotional" },
  { value: "chill", label: "Chill" },
  { value: "victorious", label: "Victorious" },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 1000
  );
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

type SongStatus = "ready" | "no_audio" | "generating";

function getSongStatus(song: Song): SongStatus {
  if (song.status === "generated" || song.vocal_path || song.mix_path) return "ready";
  return "no_audio";
}

// ─── Song Card ──────────────────────────────────────────────────────────────

function SongCard({
  song,
  isPlaying,
  isCurrentSong,
  onPlay,
  onPause,
  onDelete,
}: {
  song: Song;
  isPlaying: boolean;
  isCurrentSong: boolean;
  onPlay: (song: Song) => void;
  onPause: () => void;
  onDelete: (song: Song) => void;
}) {
  const router = useRouter();
  const status = getSongStatus(song);
  const hasAudio = status === "ready";
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const result = await exportSong({ song_id: song.id, format: "wav" });
      if (result.job_id) {
        const url = getExportDownloadUrl(result.job_id);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${song.title}.wav`;
        a.click();
      }
    } catch {
      // silent
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      className={`group rounded-xl border p-4 transition-all ${
        isCurrentSong
          ? "border-[#FF6B35]/40 bg-[#FF6B35]/[0.04]"
          : "border-[#1c1b18] bg-[#0a0a09] hover:border-[#2a2923]"
      }`}
    >
      {/* Row 1: Play + Title + Status */}
      <div className="flex items-center gap-3">
        {/* Play / Status indicator */}
        {hasAudio ? (
          <button
            type="button"
            onClick={() => (isPlaying ? onPause() : onPlay(song))}
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-all ${
              isPlaying
                ? "bg-[#FF6B35] text-black scale-105"
                : "bg-[#FF6B35] text-black hover:scale-110 hover:shadow-lg hover:shadow-[#FF6B35]/20"
            }`}
          >
            {isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4 ml-0.5" />
            )}
          </button>
        ) : (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#111110] border border-[#1c1b18]">
            <Mic className="h-4 w-4 text-[#3A3632]" />
          </div>
        )}

        {/* Title + meta */}
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[14px] font-semibold text-[#F0EDE8]">
            {song.title}
          </h3>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[#6B6560]">
            {song.genre && (
              <span>{song.genre.replace("_", " ")}</span>
            )}
            {song.bpm ? (
              <>
                <span className="text-[#3A3632]">·</span>
                <span>{song.bpm} BPM</span>
              </>
            ) : null}
            <span className="text-[#3A3632]">·</span>
            <span className="text-[#3A3632]">{timeAgo(song.updated_at)}</span>
          </div>
        </div>

        {/* Status badge */}
        <div className="shrink-0">
          {isPlaying ? (
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#FF6B35]">
              <Volume2 className="h-3.5 w-3.5" />
              Playing
            </span>
          ) : hasAudio ? (
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Ready
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-[#3A3632]">
              <AlertCircle className="h-3.5 w-3.5" />
              No audio
            </span>
          )}
        </div>
      </div>

      {/* Row 2: Actions — always visible for clarity */}
      <div className="mt-3 flex items-center gap-1.5 pl-14">
        <button
          type="button"
          onClick={() => router.push(`/studio/${song.id}`)}
          className="flex items-center gap-1.5 rounded-lg bg-[#111110] border border-[#1c1b18] px-3 py-1.5 text-[11px] font-medium text-[#6B6560] transition hover:border-[#2a2923] hover:text-[#F0EDE8]"
        >
          <ExternalLink className="h-3 w-3" />
          Open Studio
        </button>

        {hasAudio && (
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-1.5 rounded-lg bg-[#111110] border border-[#1c1b18] px-3 py-1.5 text-[11px] font-medium text-[#6B6560] transition hover:border-[#2a2923] hover:text-[#F0EDE8] disabled:opacity-40"
          >
            {downloading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Download className="h-3 w-3" />
            )}
            Download WAV
          </button>
        )}

        {!hasAudio && (
          <button
            type="button"
            onClick={() => router.push(`/studio/${song.id}`)}
            className="flex items-center gap-1.5 rounded-lg bg-[#FF6B35]/10 border border-[#FF6B35]/20 px-3 py-1.5 text-[11px] font-semibold text-[#FF6B35] transition hover:bg-[#FF6B35]/15"
          >
            <Mic className="h-3 w-3" />
            Generate Vocal
          </button>
        )}

        <button
          type="button"
          onClick={() => onDelete(song)}
          className="ml-auto flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] text-[#231F1C] transition hover:text-red-500"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

// ─── Recording Overlay ──────────────────────────────────────────────────────

function RecordingOverlay({
  status,
  onCancel,
}: {
  status: string;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-lg animate-fade-in">
      <div className="mx-4 w-full max-w-xs text-center animate-fade-up">
        <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-full bg-[#FF2D2D]/5">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FF2D2D]/10">
            <div
              className="h-3.5 w-3.5 rounded-full bg-[#FF2D2D]"
              style={{ animation: "recording-pulse 1.5s ease-in-out infinite" }}
            />
          </div>
        </div>
        <p className="font-display mb-2 text-lg italic text-[#F0EDE8]">
          Recording...
        </p>
        <p className="mb-8 text-[12px] text-[#6B6560]">{status}</p>
        <div className="mx-auto mb-8 h-[1px] w-40 overflow-hidden bg-[#1c1b18]">
          <div
            className="h-full w-1/4 bg-gradient-to-r from-transparent via-[#FF6B35] to-transparent"
            style={{ animation: "progress-sweep 2s ease-in-out infinite" }}
          />
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-[11px] text-[#3A3632] transition hover:text-[#6B6560]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── PenLine icon ───────────────────────────────────────────────────────────

function PenLine({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z" />
    </svg>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function HomePage() {
  const router = useRouter();

  // ── Creation state ──
  const [showCustom, setShowCustom] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [customLyrics, setCustomLyrics] = useState("");
  const [genre, setGenre] = useState<Genre>("hip_hop");
  const [mood, setMood] = useState("dark");
  const [quality, setQuality] = useState<Quality>("draft");
  const [beatFile, setBeatFile] = useState<File | null>(null);
  const beatInputRef = useRef<HTMLInputElement>(null);
  const [voice, setVoice] = useState<VoiceSelection>({ engine: "xtts" });

  // ── Generation state ──
  const [creating, setCreating] = useState(false);
  const [creationStatus, setCreationStatus] = useState("");
  const [creationError, setCreationError] = useState<string | null>(null);
  const [justCreatedId, setJustCreatedId] = useState<string | null>(null);

  // ── Library state ──
  const [songs, setSongs] = useState<Song[]>([]);
  const [loadingSongs, setLoadingSongs] = useState(true);
  const [playingSongId, setPlayingSongId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // ── Load songs ──
  const loadSongs = useCallback(async () => {
    try {
      setLoadingSongs(true);
      const projects = await listProjects();
      const allSongs: Song[] = [];
      for (const project of projects) {
        try {
          const projectSongs = await listSongsByProject(project.id);
          allSongs.push(...projectSongs);
        } catch { /* skip */ }
      }
      allSongs.sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
      setSongs(allSongs);
    } catch {
      setSongs([]);
    } finally {
      setLoadingSongs(false);
    }
  }, []);

  useEffect(() => {
    loadSongs();
  }, [loadSongs]);

  // ── Listen for player stop events ──
  useEffect(() => {
    function handlePlayerEvent(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (detail.action === "stopped") {
        setIsPlaying(false);
      }
    }
    window.addEventListener("mm:player:status", handlePlayerEvent);
    return () => window.removeEventListener("mm:player:status", handlePlayerEvent);
  }, []);

  // ── Create Song ──
  const handleCreate = useCallback(async () => {
    const input = showCustom ? customLyrics.trim() : prompt.trim();
    if (!input) return;

    setCreating(true);
    setCreationError(null);
    setCreationStatus("Setting up...");

    try {
      const project = await createProject({
        title: prompt.trim().slice(0, 50) || "My Song",
        user_id: "default-user",
      });

      let lyrics = showCustom ? customLyrics : "";
      if (!showCustom && prompt.trim()) {
        setCreationStatus("Writing lyrics...");
        const result = await generateLyrics({
          prompt: prompt.trim(),
          genre,
          mood,
          quality,
        });
        lyrics = result.lyrics;
      }

      setCreationStatus("Creating song...");
      const song = await createSong({
        title: prompt.trim().slice(0, 60) || "Untitled",
        lyrics: lyrics || undefined,
        genre,
        mood,
        project_id: project.id,
      });

      if (beatFile) {
        setCreationStatus("Uploading beat...");
        await uploadBeat(song.id, beatFile);
      }

      setCreationStatus(
        voice.engine === "azure"
          ? "Generating vocals (Azure Cloud)..."
          : voice.engine === "recorded"
            ? "Generating vocals (your voice)..."
            : "Generating vocals..."
      );
      const job = await generateSong({
        song_id: song.id,
        prompt: `${genre} ${mood} track`,
        lyrics: lyrics || undefined,
        quality,
        voice_engine: voice.engine,
        azure_voice: voice.azureVoice,
        voice_clip_path: voice.voiceClipPath,
      });

      let status = job.status;
      while (status === "pending" || status === "processing") {
        await new Promise((r) => setTimeout(r, 2000));
        const jobStatus = await getRenderJobStatus(job.job_id);
        status = jobStatus.status;
        if (status === "failed") {
          throw new Error(jobStatus.error ?? "Generation failed");
        }
      }

      // Done — stay on homepage, refresh list, highlight new song
      setPrompt("");
      setCustomLyrics("");
      setBeatFile(null);
      setJustCreatedId(song.id);
      await loadSongs();
      setCreating(false);

      // Auto-clear highlight after 5s
      setTimeout(() => setJustCreatedId(null), 5000);
    } catch (err) {
      setCreationError(
        err instanceof Error ? err.message : "Something went wrong"
      );
      setCreating(false);
    }
  }, [prompt, customLyrics, genre, mood, quality, beatFile, showCustom, voice, loadSongs]);

  // ── Play handler ──
  const handlePlay = useCallback((song: Song) => {
    const audioUrl = getSongAudioUrl(song.id);
    setPlayingSongId(song.id);
    setIsPlaying(true);
    window.dispatchEvent(
      new CustomEvent("mm:player", {
        detail: {
          action: "play",
          song: {
            id: song.id,
            title: song.title,
            genre: song.genre,
            audioUrl,
          },
        },
      })
    );
  }, []);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
    window.dispatchEvent(
      new CustomEvent("mm:player", { detail: { action: "pause" } })
    );
  }, []);

  // ── Delete handler ──
  const handleDelete = useCallback(async (song: Song) => {
    if (playingSongId === song.id) {
      handlePause();
      setPlayingSongId(null);
    }
    try {
      await deleteSong(song.id);
      setSongs((prev) => prev.filter((s) => s.id !== song.id));
    } catch {
      // silent
    }
  }, [playingSongId, handlePause]);

  const hasInput = prompt.trim().length > 0 || customLyrics.trim().length > 0;

  const readySongs = songs.filter((s) => getSongStatus(s) === "ready");
  const draftSongs = songs.filter((s) => getSongStatus(s) !== "ready");

  return (
    <>
      {creating && (
        <RecordingOverlay
          status={creationStatus}
          onCancel={() => setCreating(false)}
        />
      )}

      <div className="min-h-screen pb-32">
        {/* ═══ HERO — CREATE ═══ */}
        <div className="hero-spotlight mx-auto max-w-xl px-5 pt-16 pb-10 sm:px-6">
          <h1
            className="font-display mb-3 text-center text-[42px] font-light italic leading-[1.1] tracking-[-0.02em] text-[#F0EDE8] sm:text-[52px] animate-fade-up stagger-1"
            style={{ opacity: 0 }}
          >
            What do you want
            <br />
            to hear?
          </h1>
          <p
            className="mb-10 text-center text-[12px] text-[#6B6560] animate-fade-up stagger-2"
            style={{ opacity: 0 }}
          >
            Everything runs on your machine. Zero API calls.
          </p>

          {/* Prompt */}
          <div className="animate-fade-up stagger-3" style={{ opacity: 0 }}>
            {!showCustom ? (
              <div className="prompt-console relative rounded-2xl bg-[#0a0a09] border border-[#1c1b18]">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="late night sessions, heavy 808s, lyrics about chasing something nobody else can see..."
                  rows={3}
                  className="w-full resize-none rounded-2xl bg-transparent px-5 py-4 pr-16 text-[15px] leading-relaxed text-[#F0EDE8] placeholder-[#3A3632] outline-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && hasInput) {
                      handleCreate();
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={!hasInput || creating}
                  onClick={handleCreate}
                  className="absolute right-3 bottom-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#FF6B35] text-black shadow-lg shadow-[#FF6B35]/15 transition-all hover:bg-[#FF8555] hover:scale-105 active:scale-95 disabled:opacity-15 disabled:shadow-none disabled:hover:scale-100"
                >
                  <Zap className="h-[18px] w-[18px]" />
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Song title..."
                  className="w-full rounded-xl border border-[#1c1b18] bg-[#0a0a09] px-4 py-3 text-[14px] text-[#F0EDE8] placeholder-[#3A3632] outline-none transition focus:border-[#2a2923]"
                />
                <div className="prompt-console rounded-2xl bg-[#0a0a09] border border-[#1c1b18]">
                  <textarea
                    value={customLyrics}
                    onChange={(e) => setCustomLyrics(e.target.value)}
                    placeholder={"[Verse 1]\nYour lyrics here...\n\n[Hook]\nThe part they can't forget..."}
                    rows={10}
                    className="w-full resize-y rounded-2xl bg-transparent px-5 py-4 font-mono text-[13px] leading-relaxed text-[#F0EDE8] placeholder-[#3A3632] outline-none"
                  />
                </div>
                <button
                  type="button"
                  disabled={!hasInput || creating}
                  onClick={handleCreate}
                  className="w-full rounded-xl bg-[#FF6B35] py-3 text-[13px] font-bold text-black shadow-lg shadow-[#FF6B35]/15 transition hover:bg-[#FF8555] disabled:opacity-20 disabled:shadow-none"
                >
                  Create Song
                </button>
              </div>
            )}
          </div>

          {/* Toggle */}
          <div className="mt-3 text-center animate-fade-up stagger-4" style={{ opacity: 0 }}>
            <button
              type="button"
              onClick={() => setShowCustom(!showCustom)}
              className="inline-flex items-center gap-1.5 text-[11px] text-[#6B6560] transition hover:text-[#F0EDE8]"
            >
              {showCustom ? (
                <><Sparkles className="h-3 w-3" /> or describe what you want</>
              ) : (
                <><PenLine className="h-3 w-3" /> or write your own lyrics</>
              )}
            </button>
          </div>

          {/* Style controls */}
          <div className="mt-5 animate-fade-up stagger-5" style={{ opacity: 0 }}>
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              {GENRES.map((g) => (
                <button key={g.value} type="button" onClick={() => setGenre(g.value)}
                  className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold tracking-wide transition-all ${genre === g.value ? "bg-[#FF6B35]/10 text-[#FF6B35]" : "text-[#3A3632] hover:text-[#6B6560]"}`}
                >{g.label}</button>
              ))}
              <span className="mx-1.5 h-3 w-px bg-[#1c1b18]" />
              {MOODS.map((m) => (
                <button key={m.value} type="button" onClick={() => setMood(m.value)}
                  className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold tracking-wide transition-all ${mood === m.value ? "bg-[#FF6B35]/10 text-[#FF6B35]" : "text-[#3A3632] hover:text-[#6B6560]"}`}
                >{m.label}</button>
              ))}
            </div>
            {/* Voice picker */}
            <div className="mt-3 flex justify-center">
              <VoicePicker value={voice} onChange={setVoice} />
            </div>

            <div className="mt-3 flex items-center justify-center gap-3">
              <input ref={beatInputRef} type="file" accept="audio/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) setBeatFile(f); }} />
              <button type="button" onClick={() => beatInputRef.current?.click()}
                className={`flex items-center gap-1.5 text-[11px] font-medium transition ${beatFile ? "text-emerald-600" : "text-[#3A3632] hover:text-[#6B6560]"}`}
              >
                <Music className="h-3 w-3" />
                {beatFile ? beatFile.name : "upload beat"}
              </button>
              {beatFile && <button type="button" onClick={() => setBeatFile(null)} className="text-[10px] text-[#3A3632] hover:text-red-500">remove</button>}
              <span className="h-3 w-px bg-[#1c1b18]" />
              <button type="button" onClick={() => setQuality(quality === "draft" ? "render" : "draft")}
                className={`text-[11px] font-medium transition ${quality === "render" ? "text-[#FF6B35]" : "text-[#3A3632] hover:text-[#6B6560]"}`}
              >{quality === "draft" ? "draft" : "render HQ"}</button>
            </div>
          </div>

          {/* Error */}
          {creationError && (
            <div className="mt-5 rounded-xl border border-red-900/30 bg-red-900/5 px-4 py-3 text-[12px] text-red-400/80">
              {creationError}
              <button type="button" onClick={() => setCreationError(null)} className="ml-2 underline hover:text-red-300">dismiss</button>
            </div>
          )}

          {/* Shortcut */}
          {!showCustom && (
            <p className="mt-4 text-center text-[10px] text-[#231F1C] animate-fade-up stagger-6" style={{ opacity: 0 }}>
              <kbd className="rounded border border-[#1c1b18] px-1.5 py-0.5 font-mono text-[#3A3632]">Ctrl</kbd>
              {" + "}
              <kbd className="rounded border border-[#1c1b18] px-1.5 py-0.5 font-mono text-[#3A3632]">Enter</kbd>
            </p>
          )}
        </div>

        {/* ═══ SONG LIBRARY ═══ */}
        <div className="mx-auto max-w-xl px-5 sm:px-6">
          <div className="warm-divider mb-6" />

          {/* Just created success message */}
          {justCreatedId && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-900/30 bg-emerald-900/5 px-4 py-3 text-[12px] text-emerald-500 animate-fade-up">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Song created! Click the play button to listen.
            </div>
          )}

          {/* Ready songs */}
          {readySongs.length > 0 && (
            <>
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6B6560]">
                  Ready to play
                </h2>
                <span className="font-mono text-[10px] text-[#3A3632]">
                  {readySongs.length}
                </span>
              </div>
              <div className="space-y-2 mb-8">
                {readySongs.map((song) => (
                  <SongCard
                    key={song.id}
                    song={song}
                    isPlaying={playingSongId === song.id && isPlaying}
                    isCurrentSong={playingSongId === song.id || justCreatedId === song.id}
                    onPlay={handlePlay}
                    onPause={handlePause}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </>
          )}

          {/* Draft songs (no audio) */}
          {draftSongs.length > 0 && (
            <>
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#3A3632]">
                  Needs vocal
                </h2>
                <span className="font-mono text-[10px] text-[#231F1C]">
                  {draftSongs.length}
                </span>
              </div>
              <div className="space-y-2">
                {draftSongs.map((song) => (
                  <SongCard
                    key={song.id}
                    song={song}
                    isPlaying={false}
                    isCurrentSong={false}
                    onPlay={handlePlay}
                    onPause={handlePause}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </>
          )}

          {/* Loading */}
          {loadingSongs && (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 animate-pulse rounded-xl bg-[#0a0a09] border border-[#1c1b18]" style={{ animationDelay: `${i * 100}ms` }} />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!loadingSongs && songs.length === 0 && (
            <div className="flex flex-col items-center py-16">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#0a0a09]">
                <Mic className="h-5 w-5 text-[#1c1b18]" />
              </div>
              <p className="text-[12px] text-[#3A3632]">No songs yet</p>
              <p className="mt-1 text-[11px] text-[#231F1C]">Describe your first song above</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
