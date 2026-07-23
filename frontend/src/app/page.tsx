"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Play,
  Pause,
  Music,
  Zap,
  Mic,
  Radio,
  Download,
  Trash2,
  ExternalLink,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Volume2,
  Upload,
  X,
  ArrowLeft,
  ArrowRight,
  MessageSquare,
  Bookmark,
  BookmarkCheck,
} from "lucide-react";
import VoiceRecorder from "@/components/VoiceRecorder";
import { uploadVoiceClip } from "@/lib/uploadVoiceClip";
import {
  listProjects,
  listSongsByProject,
  createProject,
  createSong,
  updateSong,
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
  { value: "gospel_funk", label: "Gospel Funk" },
  { value: "metal", label: "Metal (instrumental)" },
];

const INSTRUMENTAL_GENRES: Genre[] = ["metal"];

const MOODS = [
  { value: "dark", label: "Dark" },
  { value: "hype", label: "Hype" },
  { value: "aggressive", label: "Aggressive" },
  { value: "emotional", label: "Emotional" },
  { value: "chill", label: "Chill" },
  { value: "funky", label: "Funky" },
  { value: "reflective", label: "Reflective" },
  { value: "victorious", label: "Victorious" },
];

// ─── Style Mixers ───────────────────────────────────────────────────────────
// Stackable multi-select tags to fine-tune the vibe. Empty is fine — these
// are optional spice. Each selected chip is appended to the LLM prompt.

type MixerCategory = "era" | "instruments" | "energy";

const STYLE_MIXERS: { key: MixerCategory; label: string; chips: string[] }[] = [
  {
    key: "era",
    label: "Era",
    chips: ["60s", "70s", "80s", "90s", "00s", "10s", "20s"],
  },
  {
    key: "instruments",
    label: "Instruments",
    chips: [
      "Hammond",
      "808s",
      "Choir",
      "Piano",
      "Synth",
      "Guitar",
      "Tambourine",
      "Strings",
      "Sax",
      "Bass",
    ],
  },
  {
    key: "energy",
    label: "Energy",
    chips: [
      "Smooth",
      "Gritty",
      "Spacey",
      "Lo-fi grit",
      "Tight",
      "Loose",
      "Live",
      "Drum-machine",
    ],
  },
];

type StyleMixers = { era: string[]; instruments: string[]; energy: string[] };

const EMPTY_MIXERS: StyleMixers = { era: [], instruments: [], energy: [] };

function flattenMixers(mixers: StyleMixers): string[] {
  return [...mixers.era, ...mixers.instruments, ...mixers.energy];
}

function buildPromptWithMixers(basePrompt: string, mixers: StyleMixers): string {
  const tags = flattenMixers(mixers);
  if (!tags.length) return basePrompt;
  const suffix = ` — style: ${tags.join(", ")}`;
  return basePrompt ? `${basePrompt}${suffix}` : suffix.replace(/^ — /, "");
}

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
          ? "border-[#B432FF]/40 bg-[#B432FF]/[0.04]"
          : "border-[#2A1A4A] bg-[#0D0A14] hover:border-[#3D2466]"
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
                ? "bg-[#B432FF] text-white scale-105"
                : "bg-[#B432FF] text-white hover:scale-110 hover:shadow-lg hover:shadow-[#B432FF]/20"
            }`}
          >
            {isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4 ml-0.5" />
            )}
          </button>
        ) : (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#1A0A2E] border border-[#2A1A4A]">
            <Mic className="h-4 w-4 text-[#4A3F60]" />
          </div>
        )}

        {/* Title + meta */}
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[14px] font-semibold text-[#E0D0F0]">
            {song.title}
          </h3>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[#8A7FA8]">
            {song.genre && (
              <span>{song.genre.replace("_", " ")}</span>
            )}
            {song.bpm ? (
              <>
                <span className="text-[#4A3F60]">·</span>
                <span>{song.bpm} BPM</span>
              </>
            ) : null}
            <span className="text-[#4A3F60]">·</span>
            <span className="text-[#4A3F60]">{timeAgo(song.updated_at)}</span>
          </div>
        </div>

        {/* Status badge */}
        <div className="shrink-0">
          {isPlaying ? (
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#B432FF]">
              <Volume2 className="h-3.5 w-3.5" />
              Playing
            </span>
          ) : hasAudio ? (
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Ready
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-[#4A3F60]">
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
          className="flex items-center gap-1.5 rounded-lg bg-[#1A0A2E] border border-[#2A1A4A] px-3 py-1.5 text-[11px] font-medium text-[#8A7FA8] transition hover:border-[#3D2466] hover:text-[#E0D0F0]"
        >
          <ExternalLink className="h-3 w-3" />
          Open Studio
        </button>

        {hasAudio && (
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-1.5 rounded-lg bg-[#1A0A2E] border border-[#2A1A4A] px-3 py-1.5 text-[11px] font-medium text-[#8A7FA8] transition hover:border-[#3D2466] hover:text-[#E0D0F0] disabled:opacity-40"
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
            className="flex items-center gap-1.5 rounded-lg bg-[#B432FF]/10 border border-[#B432FF]/20 px-3 py-1.5 text-[11px] font-semibold text-[#B432FF] transition hover:bg-[#B432FF]/15"
          >
            <Mic className="h-3 w-3" />
            Generate Vocal
          </button>
        )}

        <button
          type="button"
          onClick={() => onDelete(song)}
          className="ml-auto flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] text-[#2D2640] transition hover:text-red-500"
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#07060B]/90 backdrop-blur-lg animate-fade-in">
      <div className="mx-4 w-full max-w-xs text-center animate-fade-up">
        <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-full bg-[#FF3388]/5">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FF3388]/10">
            <div
              className="h-3.5 w-3.5 rounded-full bg-[#FF3388]"
              style={{ animation: "recording-pulse 1.5s ease-in-out infinite" }}
            />
          </div>
        </div>
        <p className="font-display mb-2 text-lg italic text-[#E0D0F0]">
          Recording...
        </p>
        <p className="mb-8 text-[12px] text-[#8A7FA8]">{status}</p>
        <div className="mx-auto mb-8 h-[1px] w-40 overflow-hidden bg-[#2A1A4A]">
          <div
            className="h-full w-1/4 bg-gradient-to-r from-transparent via-[#B432FF] to-transparent"
            style={{ animation: "progress-sweep 2s ease-in-out infinite" }}
          />
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-[11px] text-[#4A3F60] transition hover:text-[#8A7FA8]"
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

// ─── Wizard helpers ─────────────────────────────────────────────────────────

const WIZARD_STEPS = ["Words", "Vibe", "Voice", "Beat"] as const;
type WizardStep = 1 | 2 | 3 | 4;

function WizardProgress({ step, instrumental }: { step: WizardStep; instrumental?: boolean }) {
  // Voice step is dropped when the chosen genre is instrumental-only
  const steps = instrumental
    ? ["Words", "Vibe", "Beat"]
    : ["Words", "Vibe", "Voice", "Beat"];
  // Map our internal step index (1-4) onto the visible dot index
  const visibleStep = instrumental && step === 4 ? 3 : step;
  return (
    <div className="mb-6 flex items-center justify-center gap-2">
      {steps.map((label, i) => {
        const n = i + 1;
        const active = n === visibleStep;
        const done = n < visibleStep;
        return (
          <div key={label} className="flex items-center gap-2">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full font-mono text-[10px] font-bold transition ${
                  active
                    ? "bg-[#B432FF] text-white shadow-lg shadow-[#B432FF]/30"
                    : done
                      ? "bg-[#B432FF]/20 text-[#B432FF]"
                      : "bg-[#1A0A2E] text-[#4A3F60]"
                }`}
              >
                {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : n}
              </div>
              <span
                className={`mt-1 font-tech text-[9px] font-semibold uppercase tracking-[0.15em] transition ${
                  active || done ? "text-[#E0D0F0]" : "text-[#4A3F60]"
                }`}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`mb-4 h-px w-6 transition ${
                  done ? "bg-[#B432FF]/40" : "bg-[#2A1A4A]"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function PanelHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6 text-center">
      <h2 className="font-display text-[20px] font-black tracking-[0.04em] text-bankai-gradient">
        {title.toUpperCase()}
      </h2>
      {subtitle && (
        <p className="font-tech mt-1.5 text-[11px] uppercase tracking-[0.18em] text-[#8A7FA8]">
          {subtitle}
        </p>
      )}
    </div>
  );
}

function VoiceTile({
  icon: Icon,
  title,
  subtitle,
  active,
  badge,
  onClick,
}: {
  icon: typeof Mic;
  title: string;
  subtitle: string;
  active?: boolean;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-4 rounded-xl border p-4 text-left transition ${
        active
          ? "border-[#B432FF] bg-[#B432FF]/10 ring-1 ring-[#B432FF]/30"
          : "border-[#2A1A4A] bg-[#0D0A14] hover:border-[#3D2466] hover:bg-[#1A0A2E]/50"
      }`}
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
          active ? "bg-[#B432FF] text-white" : "bg-[#1A0A2E] text-[#B432FF]"
        }`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-[13px] font-semibold text-[#E0D0F0]">{title}</p>
          {badge && (
            <span className="font-tech rounded-md bg-[#FF3388]/15 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest text-[#FF3388]">
              {badge}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[11px] text-[#8A7FA8]">{subtitle}</p>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-[#4A3F60]" />
    </button>
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
  const [styleMixers, setStyleMixers] = useState<StyleMixers>(EMPTY_MIXERS);
  const [beatFile, setBeatFile] = useState<File | null>(null);
  const beatInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [voice, setVoice] = useState<VoiceSelection>({ engine: "xtts" });

  // ── Wizard state ──
  const [step, setStep] = useState<WizardStep>(1);
  const [voiceMode, setVoiceMode] = useState<"none" | "describe" | "record" | "elevenlabs">("none");
  const [voiceDescription, setVoiceDescription] = useState("");
  const [voiceUploading, setVoiceUploading] = useState(false);
  const [elevenLabsVoices, setElevenLabsVoices] = useState<Array<{ key: string; name: string; gender: string; desc: string; category?: string }>>([]);
  const [elevenLabsLoading, setElevenLabsLoading] = useState(false);
  // Voice Design (ElevenLabs) previews — three audio candidates to audition
  const [vdPreviews, setVdPreviews] = useState<Array<{ generated_voice_id: string; audio_base_64: string; media_type?: string }>>([]);
  const [vdLoading, setVdLoading] = useState(false);
  const [vdError, setVdError] = useState<string | null>(null);
  // Track which ElevenLabs voices have been saved as personas (by voice_id)
  const [savedPersonaVoiceIds, setSavedPersonaVoiceIds] = useState<Set<string>>(new Set());
  const [savingPersonaVoiceId, setSavingPersonaVoiceId] = useState<string | null>(null);
  // Full list of saved ElevenLabs personas — rendered as a quick-recall row
  const [savedPersonas, setSavedPersonas] = useState<Array<{
    id: string;
    name: string;
    description: string | null;
    elevenlabs_voice_id: string;
  }>>([]);
  // Saved XTTS-recorded voice personas (clips the user recorded + saved)
  const [savedRecordedPersonas, setSavedRecordedPersonas] = useState<Array<{
    id: string;
    name: string;
    description: string | null;
    voice_sample_path: string;
  }>>([]);
  // After a fresh recording, hold its path here until the user saves or continues
  const [pendingRecordingPath, setPendingRecordingPath] = useState<string | null>(null);
  const [pendingRecordingName, setPendingRecordingName] = useState("");
  const [savingRecording, setSavingRecording] = useState(false);
  const [recordingSavedAs, setRecordingSavedAs] = useState<string | null>(null);

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
        title: prompt.trim().slice(0, 50) || (isInstrumental ? "Instrumental" : "My Song"),
        user_id: "default-user",
      });

      // ── Instrumental fast-path: skip lyrics + vocals, the beat IS the song ──
      if (isInstrumental) {
        setCreationStatus("Saving song...");
        const song = await createSong({
          title: prompt.trim().slice(0, 60) || "Untitled Instrumental",
          genre,
          mood,
          project_id: project.id,
        });
        if (!beatFile) throw new Error("Instrumental mode requires a beat upload");
        setCreationStatus("Uploading instrumental...");
        const upload = await uploadBeat(song.id, beatFile);
        setCreationStatus("Finalizing...");
        await updateSong(song.id, {
          mix_path: upload.file_path,
          status: "generated",
        });
        setPrompt("");
        setCustomLyrics("");
        setBeatFile(null);
        setVoice({ engine: "xtts" });
        setVoiceMode("none");
        setVoiceDescription("");
        setStyleMixers(EMPTY_MIXERS);
        setStep(1);
        setJustCreatedId(song.id);
        await loadSongs();
        setCreating(false);
        setTimeout(() => setJustCreatedId(null), 5000);
        return;
      }

      const mixerTags = flattenMixers(styleMixers);

      let lyrics = showCustom ? customLyrics : "";
      if (!showCustom && prompt.trim()) {
        setCreationStatus("Writing lyrics...");
        const result = await generateLyrics({
          prompt: buildPromptWithMixers(prompt.trim(), styleMixers),
          genre,
          mood,
          quality,
          style_tags: mixerTags.length ? mixerTags : undefined,
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
        prompt: buildPromptWithMixers(`${genre} ${mood} track`, styleMixers),
        lyrics: lyrics || undefined,
        quality,
        voice_engine: voice.engine,
        azure_voice: voice.azureVoice,
        elevenlabs_voice_id: voice.elevenLabsVoiceId,
        persona_id: voice.personaId,
        voice_clip_path: voice.voiceClipPath,
        voice_description: voice.description,
        style_tags: mixerTags.length ? mixerTags : undefined,
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
      setVoice({ engine: "xtts" });
      setVoiceMode("none");
      setVoiceDescription("");
      setStyleMixers(EMPTY_MIXERS);
      setStep(1);
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
  }, [prompt, customLyrics, genre, mood, quality, beatFile, showCustom, voice, styleMixers, loadSongs]);

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

  const isInstrumental = INSTRUMENTAL_GENRES.includes(genre);
  const hasInput = isInstrumental
    ? !!beatFile  // instrumental needs a beat, lyrics are optional
    : prompt.trim().length > 0 || customLyrics.trim().length > 0;

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
        {/* ═══ HERO — WIZARD ═══ */}
        <div className="hero-spotlight mx-auto max-w-xl px-5 pt-12 pb-10 sm:px-6">
          <h1
            className="font-display mb-2 text-center text-[28px] font-black leading-[1.1] tracking-[0.06em] text-bankai-gradient sm:text-[34px] animate-fade-up stagger-1"
            style={{ opacity: 0 }}
          >
            WHAT DO YOU WANT TO HEAR
          </h1>
          <p
            className="font-tech mb-8 text-center text-[9px] uppercase tracking-[0.3em] text-[#8A7FA8] animate-fade-up stagger-2"
            style={{ opacity: 0 }}
          >
            100% local · Zero API calls · The dark side of music
          </p>

          <WizardProgress step={step} instrumental={isInstrumental} />

          <div
            key={step}
            className="rounded-2xl border border-[#2A1A4A] bg-[#0D0A14] p-6 animate-fade-up"
          >
            {step === 1 && (
              <>
                <PanelHeader title="Words" subtitle="Describe it, or write your own bars" />
                <div className="mb-4 inline-flex rounded-lg bg-[#1A0A2E] p-0.5">
                  <button
                    type="button"
                    onClick={() => setShowCustom(false)}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-semibold transition ${
                      !showCustom
                        ? "bg-[#B432FF]/15 text-[#B432FF]"
                        : "text-[#8A7FA8] hover:text-[#E0D0F0]"
                    }`}
                  >
                    <Sparkles className="h-3 w-3" /> Describe
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCustom(true)}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-semibold transition ${
                      showCustom
                        ? "bg-[#B432FF]/15 text-[#B432FF]"
                        : "text-[#8A7FA8] hover:text-[#E0D0F0]"
                    }`}
                  >
                    <PenLine className="h-3 w-3" /> Write lyrics
                  </button>
                </div>
                {!showCustom ? (
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="late night sessions, heavy 808s, lyrics about chasing something nobody else can see..."
                    rows={4}
                    autoFocus
                    className="w-full resize-none rounded-xl bg-[#1A0A2E]/40 px-3 py-2.5 text-[14px] leading-relaxed text-[#E0D0F0] placeholder-[#4A3F60] outline-none focus:bg-[#1A0A2E]/70"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && hasInput) {
                        setStep(2);
                      }
                    }}
                  />
                ) : (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="Song title (optional)…"
                      className="w-full rounded-xl bg-[#1A0A2E]/40 px-3 py-2 text-[13px] text-[#E0D0F0] placeholder-[#4A3F60] outline-none focus:bg-[#1A0A2E]/70"
                    />
                    <textarea
                      value={customLyrics}
                      onChange={(e) => setCustomLyrics(e.target.value)}
                      placeholder={"[Verse 1]\nYour lyrics here...\n\n[Hook]\nThe part they can't forget..."}
                      rows={8}
                      className="w-full resize-y rounded-xl bg-[#1A0A2E]/40 px-3 py-2.5 font-mono text-[12px] leading-relaxed text-[#E0D0F0] placeholder-[#4A3F60] outline-none focus:bg-[#1A0A2E]/70"
                    />
                  </div>
                )}
                <div className="mt-5 flex justify-end">
                  <button
                    type="button"
                    disabled={!hasInput}
                    onClick={() => setStep(2)}
                    className="flex items-center gap-2 rounded-xl bg-[#B432FF] px-5 py-2.5 text-[12px] font-bold text-white transition hover:bg-[#C758FF] disabled:opacity-20"
                  >
                    Continue
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <PanelHeader title="Vibe" subtitle="Pick the genre, mood, and quality" />
                <div className="space-y-4">
                  <div>
                    <div className="mb-1.5 font-tech text-[9px] uppercase tracking-[0.2em] text-[#4A3F60]">
                      Genre
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {GENRES.map((g) => {
                        const isExp = INSTRUMENTAL_GENRES.includes(g.value);
                        return (
                          <button
                            key={g.value}
                            type="button"
                            onClick={() => setGenre(g.value)}
                            className={`relative rounded-lg px-3.5 py-2 text-[12px] font-semibold transition ${
                              genre === g.value
                                ? "bg-[#B432FF]/15 text-[#B432FF] ring-1 ring-[#B432FF]/30"
                                : "bg-[#1A0A2E] text-[#8A7FA8] hover:text-[#E0D0F0]"
                            }`}
                          >
                            {g.label}
                            {isExp && (
                              <span className="ml-1.5 font-tech text-[8px] font-bold uppercase tracking-widest text-[#FF3388]">
                                exp
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <div className="mb-1.5 font-tech text-[9px] uppercase tracking-[0.2em] text-[#4A3F60]">
                      Mood
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {MOODS.map((m) => (
                        <button
                          key={m.value}
                          type="button"
                          onClick={() => setMood(m.value)}
                          className={`rounded-lg px-3.5 py-2 text-[12px] font-semibold transition ${
                            mood === m.value
                              ? "bg-[#B432FF]/15 text-[#B432FF] ring-1 ring-[#B432FF]/30"
                              : "bg-[#1A0A2E] text-[#8A7FA8] hover:text-[#E0D0F0]"
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t border-[#2A1A4A]/50 pt-3">
                    <span className="font-tech text-[9px] uppercase tracking-[0.2em] text-[#4A3F60]">
                      Quality
                    </span>
                    <div className="inline-flex rounded-lg bg-[#1A0A2E] p-0.5">
                      <button
                        type="button"
                        onClick={() => setQuality("draft")}
                        className={`rounded-md px-3 py-1 text-[10px] font-semibold transition ${
                          quality === "draft" ? "bg-[#B432FF]/15 text-[#B432FF]" : "text-[#8A7FA8]"
                        }`}
                      >
                        Draft
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuality("render")}
                        className={`rounded-md px-3 py-1 text-[10px] font-semibold transition ${
                          quality === "render" ? "bg-[#B432FF]/15 text-[#B432FF]" : "text-[#8A7FA8]"
                        }`}
                      >
                        Render HQ
                      </button>
                    </div>
                  </div>

                  {/* ─── Style Mixers ─── */}
                  <div
                    data-testid="style-mixers"
                    className="-mx-1.5 mt-1 rounded-xl border-t border-[#2A1A4A]/60 bg-[#0A0814]/60 px-3 pt-4 pb-3"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span className="font-tech text-[9px] font-black uppercase tracking-[0.22em] text-[#B432FF]">
                        Style Mixers
                      </span>
                      {flattenMixers(styleMixers).length > 0 ? (
                        <span
                          data-testid="mixer-count"
                          className="font-tech text-[9px] uppercase tracking-[0.18em] text-[#B432FF]"
                        >
                          {flattenMixers(styleMixers).length} mixer
                          {flattenMixers(styleMixers).length === 1 ? "" : "s"} active
                        </span>
                      ) : (
                        <span className="font-tech text-[9px] uppercase tracking-[0.18em] text-[#4A3F60]">
                          optional — stack to taste
                        </span>
                      )}
                    </div>
                    <div className="space-y-3">
                      {STYLE_MIXERS.map((row) => {
                        const selected = styleMixers[row.key];
                        return (
                          <div key={row.key}>
                            <div className="mb-1.5 font-tech text-[9px] uppercase tracking-[0.2em] text-[#4A3F60]">
                              {row.label}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {row.chips.map((chip) => {
                                const isOn = selected.includes(chip);
                                return (
                                  <button
                                    key={chip}
                                    type="button"
                                    data-testid={`mixer-chip-${row.key}-${chip}`}
                                    aria-pressed={isOn}
                                    onClick={() =>
                                      setStyleMixers((prev) => ({
                                        ...prev,
                                        [row.key]: isOn
                                          ? prev[row.key].filter((c) => c !== chip)
                                          : [...prev[row.key], chip],
                                      }))
                                    }
                                    className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition ${
                                      isOn
                                        ? "bg-[#B432FF]/15 text-[#B432FF] ring-1 ring-[#B432FF]/30"
                                        : "bg-[#1A0A2E] text-[#8A7FA8] hover:text-[#E0D0F0]"
                                    }`}
                                  >
                                    {chip}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div className="mt-5 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-medium text-[#8A7FA8] transition hover:text-[#E0D0F0]"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" /> Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(isInstrumental ? 4 : 3)}
                    className="flex items-center gap-2 rounded-xl bg-[#B432FF] px-5 py-2.5 text-[12px] font-bold text-white transition hover:bg-[#C758FF]"
                  >
                    {isInstrumental ? "Continue (no vocals)" : "Continue"}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </>
            )}

            {step === 3 && !isInstrumental && (
              <>
                <PanelHeader
                  title="Voice"
                  subtitle="Choose a voice or record yours"
                />
                <div className="space-y-2.5">
                  <VoiceTile
                    icon={Mic}
                    title="Use default voice"
                    subtitle="Local AI vocals — XTTS v2, runs on your GPU"
                    active={voice.engine === "xtts" && voiceMode === "none"}
                    onClick={() => {
                      setVoice({ engine: "xtts" });
                      setVoiceMode("none");
                      setStep(4);
                    }}
                  />
                  <VoiceTile
                    icon={MessageSquare}
                    title="Design a voice"
                    subtitle='"Deep raspy male, NYC accent" — get 3 auditions, pick one'
                    badge="PRO"
                    active={voiceMode === "describe"}
                    onClick={() => {
                      setVdPreviews([]);
                      setVdError(null);
                      setVoiceMode(voiceMode === "describe" ? "none" : "describe");
                    }}
                  />
                  {voiceMode === "describe" && (
                    <div className="rounded-xl border border-[#B432FF]/30 bg-[#0D0A14] p-3 animate-fade-up space-y-2">
                      <textarea
                        value={voiceDescription}
                        onChange={(e) => setVoiceDescription(e.target.value)}
                        placeholder="Describe the voice — gender, tone, accent, age, energy…"
                        rows={3}
                        autoFocus
                        className="w-full resize-none rounded-lg bg-[#1A0A2E]/40 px-3 py-2 text-[13px] text-[#E0D0F0] placeholder-[#4A3F60] outline-none focus:bg-[#1A0A2E]/70"
                      />
                      <button
                        type="button"
                        disabled={!voiceDescription.trim() || vdLoading}
                        onClick={async () => {
                          setVdLoading(true);
                          setVdError(null);
                          setVdPreviews([]);
                          try {
                            const res = await fetch("/api/generate/elevenlabs/voice-design", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                description: voiceDescription.trim(),
                                user_id: "default-user",
                              }),
                            });
                            if (res.status === 402) {
                              setVdError("Voice Design is a Pro-tier feature. Upgrade to unlock, or pick the default voice.");
                              return;
                            }
                            if (!res.ok) throw new Error(`HTTP ${res.status}`);
                            const data = await res.json();
                            setVdPreviews(data.previews || []);
                          } catch (e) {
                            setVdError(e instanceof Error ? e.message : "Voice design failed");
                          } finally {
                            setVdLoading(false);
                          }
                        }}
                        className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#B432FF] py-2 text-[11px] font-bold text-white transition hover:bg-[#C758FF] disabled:opacity-20"
                      >
                        {vdLoading ? (
                          <><Loader2 className="h-3 w-3 animate-spin" /> Designing…</>
                        ) : (
                          <><Sparkles className="h-3 w-3" /> Generate 3 voices</>
                        )}
                      </button>
                      {vdError && (
                        <p className="text-[10px] text-red-400/80">{vdError}</p>
                      )}
                      {vdPreviews.length > 0 && (
                        <div className="space-y-2 pt-1">
                          <p className="font-tech text-[9px] uppercase tracking-[0.2em] text-[#4A3F60]">
                            Audition · pick one to use
                          </p>
                          {vdPreviews.map((p, i) => (
                            <div key={p.generated_voice_id} className="flex items-center gap-2 rounded-lg bg-[#1A0A2E]/60 px-2 py-2">
                              <span className="font-mono text-[10px] font-bold text-[#B432FF]">#{i + 1}</span>
                              <audio
                                controls
                                src={`data:${p.media_type || "audio/mpeg"};base64,${p.audio_base_64}`}
                                className="h-6 flex-1"
                              />
                              <button
                                type="button"
                                onClick={async () => {
                                  // Commit the preview → real voice_id, then use it
                                  try {
                                    const res = await fetch("/api/generate/elevenlabs/voice-design/commit", {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({
                                        generated_voice_id: p.generated_voice_id,
                                        voice_name: voiceDescription.trim().slice(0, 40) || "Designed voice",
                                        voice_description: voiceDescription.trim(),
                                        user_id: "default-user",
                                      }),
                                    });
                                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                                    const data = await res.json();
                                    setVoice({
                                      engine: "elevenlabs",
                                      elevenLabsVoiceId: data.voice_id,
                                      elevenLabsVoiceName: data.name,
                                    });
                                    setStep(4);
                                  } catch (e) {
                                    setVdError(e instanceof Error ? e.message : "Could not save voice");
                                  }
                                }}
                                className="rounded-md bg-[#B432FF] px-2.5 py-1 text-[10px] font-bold text-white transition hover:bg-[#C758FF]"
                              >
                                Use
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <VoiceTile
                    icon={Sparkles}
                    title="Studio voice (ElevenLabs)"
                    subtitle="Premium expressive vocals · Pro tier"
                    badge="PRO"
                    active={voiceMode === "elevenlabs"}
                    onClick={() => {
                      const next = voiceMode === "elevenlabs" ? "none" : "elevenlabs";
                      setVoiceMode(next);
                      if (next === "elevenlabs" && elevenLabsVoices.length === 0 && !elevenLabsLoading) {
                        setElevenLabsLoading(true);
                        // Load voices + already-saved personas in parallel
                        Promise.all([
                          fetch("/api/generate/voices").then((r) => r.json()),
                          fetch("/api/personas?user_id=default-user").then((r) => r.json()),
                        ])
                          .then(([voicesData, personas]) => {
                            const eng = (voicesData.engines || []).find((e: { engine: string }) => e.engine === "elevenlabs");
                            setElevenLabsVoices(eng?.voices || []);
                            const elevenPersonas = (personas || []).filter(
                              (p: { voice_engine?: string; elevenlabs_voice_id?: string }) =>
                                p.voice_engine === "elevenlabs" && p.elevenlabs_voice_id,
                            );
                            setSavedPersonas(elevenPersonas);
                            setSavedPersonaVoiceIds(
                              new Set<string>(elevenPersonas.map((p: { elevenlabs_voice_id: string }) => p.elevenlabs_voice_id)),
                            );
                          })
                          .catch(() => {})
                          .finally(() => setElevenLabsLoading(false));
                      }
                    }}
                  />
                  {voiceMode === "elevenlabs" && (
                    <div className="rounded-xl border border-[#B432FF]/30 bg-[#0D0A14] p-3 animate-fade-up">
                      {elevenLabsLoading ? (
                        <p className="py-4 text-center text-[11px] text-[#8A7FA8]">Loading voices…</p>
                      ) : elevenLabsVoices.length === 0 ? (
                        <p className="py-4 text-center text-[11px] text-[#4A3F60]">
                          No ElevenLabs voices on your account, or API key not configured.
                        </p>
                      ) : (
                        <>
                          {savedPersonas.length > 0 && (
                            <div className="mb-3">
                              <div className="mb-1.5 flex items-center gap-2">
                                <BookmarkCheck className="h-3 w-3 text-[#B432FF]" />
                                <span className="font-tech text-[9px] font-semibold uppercase tracking-[0.2em] text-[#B432FF]">
                                  Your saved voices
                                </span>
                                <span className="font-mono text-[9px] text-[#4A3F60]">
                                  {savedPersonas.length}
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-1.5">
                                {savedPersonas.map((sp) => (
                                  <button
                                    key={sp.id}
                                    type="button"
                                    onClick={() => {
                                      setVoice({
                                        engine: "elevenlabs",
                                        elevenLabsVoiceId: sp.elevenlabs_voice_id,
                                        elevenLabsVoiceName: sp.name,
                                        personaId: sp.id,
                                      });
                                      setStep(4);
                                    }}
                                    className="flex items-center gap-2 rounded-lg bg-[#B432FF]/10 border border-[#B432FF]/30 px-2.5 py-2 text-left transition hover:bg-[#B432FF]/15 hover:border-[#B432FF]/50"
                                  >
                                    <BookmarkCheck className="h-3 w-3 shrink-0 text-[#B432FF]" />
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-[11px] font-semibold text-[#E0D0F0]">{sp.name}</p>
                                      <p className="truncate text-[9px] text-[#8A7FA8]">
                                        {sp.description || "Saved ElevenLabs voice"}
                                      </p>
                                    </div>
                                  </button>
                                ))}
                              </div>
                              <div className="mt-3 h-px bg-[#2A1A4A]/60" />
                              <p className="mt-2 mb-1 font-tech text-[9px] font-semibold uppercase tracking-[0.2em] text-[#4A3F60]">
                                Full library
                              </p>
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-1.5 max-h-64 overflow-y-auto">
                          {elevenLabsVoices.map((v) => {
                            const isSaved = savedPersonaVoiceIds.has(v.key);
                            const isSaving = savingPersonaVoiceId === v.key;
                            return (
                              <div
                                key={v.key}
                                role="button"
                                tabIndex={0}
                                onClick={() => {
                                  setVoice({ engine: "elevenlabs", elevenLabsVoiceId: v.key, elevenLabsVoiceName: v.name });
                                  setStep(4);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    setVoice({ engine: "elevenlabs", elevenLabsVoiceId: v.key, elevenLabsVoiceName: v.name });
                                    setStep(4);
                                  }
                                }}
                                className="group flex cursor-pointer items-center gap-2 rounded-lg bg-[#1A0A2E] px-2.5 py-2 text-left transition hover:bg-[#241344] focus:outline-none focus:ring-1 focus:ring-[#B432FF]/40"
                              >
                                <span
                                  className={`text-[10px] ${
                                    v.gender === "male" ? "text-blue-400" :
                                    v.gender === "female" ? "text-pink-400" : "text-[#4A3F60]"
                                  }`}
                                >
                                  {v.gender === "male" ? "♂" : v.gender === "female" ? "♀" : "·"}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-[11px] font-semibold text-[#E0D0F0]">{v.name}</p>
                                  <p className="truncate text-[9px] text-[#4A3F60]">
                                    {v.category === "cloned" ? "your clone" : v.desc || v.category || ""}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if (isSaved || isSaving) return;
                                    setSavingPersonaVoiceId(v.key);
                                    try {
                                      const res = await fetch("/api/personas", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({
                                          name: v.name,
                                          description: v.desc || v.category || "ElevenLabs voice",
                                          style_mode: "melodic",
                                          voice_engine: "elevenlabs",
                                          elevenlabs_voice_id: v.key,
                                          user_id: "default-user",
                                        }),
                                      });
                                      if (!res.ok) throw new Error(`HTTP ${res.status}`);
                                      setSavedPersonaVoiceIds((prev) => new Set(prev).add(v.key));
                                    } catch {
                                      // silent — could surface a toast later
                                    } finally {
                                      setSavingPersonaVoiceId(null);
                                    }
                                  }}
                                  title={isSaved ? "Saved as persona" : "Save as persona"}
                                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition ${
                                    isSaved
                                      ? "text-[#B432FF]"
                                      : "text-[#4A3F60] opacity-0 group-hover:opacity-100 hover:bg-[#2A1A4A] hover:text-[#E0D0F0]"
                                  }`}
                                >
                                  {isSaving ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : isSaved ? (
                                    <BookmarkCheck className="h-3 w-3" />
                                  ) : (
                                    <Bookmark className="h-3 w-3" />
                                  )}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                        </>
                      )}
                    </div>
                  )}
                  <VoiceTile
                    icon={Volume2}
                    title="Record my voice"
                    subtitle="10–30s clip — your voice clones onto the lyrics"
                    active={voiceMode === "record"}
                    onClick={() => {
                      const next = voiceMode === "record" ? "none" : "record";
                      setVoiceMode(next);
                      if (next === "record") {
                        fetch("/api/personas?user_id=default-user")
                          .then((r) => r.json())
                          .then((personas) => {
                            const recorded = (personas || []).filter(
                              (p: { voice_engine?: string; voice_sample_path?: string }) =>
                                (p.voice_engine === "xtts" || !p.voice_engine) && p.voice_sample_path,
                            );
                            setSavedRecordedPersonas(recorded);
                          })
                          .catch(() => {});
                      }
                    }}
                  />
                  {voiceMode === "record" && (
                    <div className="rounded-xl border border-[#B432FF]/30 bg-[#0D0A14] p-3 animate-fade-up">
                      {savedRecordedPersonas.length > 0 && !pendingRecordingPath && (
                        <div className="mb-3">
                          <div className="mb-1.5 flex items-center gap-2">
                            <BookmarkCheck className="h-3 w-3 text-[#B432FF]" />
                            <span className="font-tech text-[9px] font-semibold uppercase tracking-[0.2em] text-[#B432FF]">
                              Your saved recordings
                            </span>
                            <span className="font-mono text-[9px] text-[#4A3F60]">
                              {savedRecordedPersonas.length}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            {savedRecordedPersonas.map((sp) => (
                              <button
                                key={sp.id}
                                type="button"
                                onClick={() => {
                                  setVoice({
                                    engine: "recorded",
                                    voiceClipPath: sp.voice_sample_path,
                                    personaId: sp.id,
                                  });
                                  setStep(4);
                                }}
                                className="flex items-center gap-2 rounded-lg bg-[#B432FF]/10 border border-[#B432FF]/30 px-2.5 py-2 text-left transition hover:bg-[#B432FF]/15 hover:border-[#B432FF]/50"
                              >
                                <BookmarkCheck className="h-3 w-3 shrink-0 text-[#B432FF]" />
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-[11px] font-semibold text-[#E0D0F0]">{sp.name}</p>
                                  <p className="truncate text-[9px] text-[#8A7FA8]">
                                    {sp.description || "Saved recording"}
                                  </p>
                                </div>
                              </button>
                            ))}
                          </div>
                          <div className="mt-3 h-px bg-[#2A1A4A]/60" />
                          <p className="mt-2 mb-1 font-tech text-[9px] font-semibold uppercase tracking-[0.2em] text-[#4A3F60]">
                            Record a new one
                          </p>
                        </div>
                      )}
                      {voiceUploading ? (
                        <p className="py-4 text-center text-[11px] text-[#8A7FA8]">
                          Uploading…
                        </p>
                      ) : pendingRecordingPath ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Radio className="h-3.5 w-3.5 text-[#B432FF]" />
                            <span className="text-[11px] font-semibold text-[#E0D0F0]">
                              Voice captured
                            </span>
                          </div>
                          <p className="text-[10px] text-[#8A7FA8]">
                            Save it as a persona to recall it later, or just continue.
                          </p>
                          <input
                            type="text"
                            value={pendingRecordingName}
                            onChange={(e) => setPendingRecordingName(e.target.value)}
                            placeholder="Name this voice (e.g. ‘My main voice’)"
                            disabled={!!recordingSavedAs}
                            className="w-full rounded-lg border border-[#2A1A4A] bg-[#0D0A14] px-3 py-2 text-[11px] text-[#E0D0F0] placeholder-[#4A3F60] focus:border-[#B432FF] focus:outline-none disabled:opacity-50"
                          />
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={savingRecording || !!recordingSavedAs || !pendingRecordingName.trim()}
                              onClick={async () => {
                                setSavingRecording(true);
                                try {
                                  const res = await fetch("/api/personas", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                      name: pendingRecordingName.trim(),
                                      description: "Saved recording",
                                      style_mode: "rap",
                                      user_id: "default-user",
                                      voice_engine: "xtts",
                                      voice_sample_path: pendingRecordingPath,
                                    }),
                                  });
                                  if (!res.ok) throw new Error("Save failed");
                                  const persona = await res.json();
                                  setRecordingSavedAs(persona.id);
                                  setVoice({
                                    engine: "recorded",
                                    voiceClipPath: pendingRecordingPath,
                                    personaId: persona.id,
                                  });
                                  setSavedRecordedPersonas((prev) => [
                                    ...prev,
                                    {
                                      id: persona.id,
                                      name: persona.name,
                                      description: persona.description,
                                      voice_sample_path: pendingRecordingPath,
                                    },
                                  ]);
                                } catch {
                                  // silent
                                } finally {
                                  setSavingRecording(false);
                                }
                              }}
                              className="flex items-center gap-1.5 rounded-lg bg-[#B432FF]/15 border border-[#B432FF]/30 px-3 py-1.5 text-[11px] font-semibold text-[#B432FF] transition hover:bg-[#B432FF]/25 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              {savingRecording ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : recordingSavedAs ? (
                                <BookmarkCheck className="h-3 w-3" />
                              ) : (
                                <Bookmark className="h-3 w-3" />
                              )}
                              {recordingSavedAs ? "Saved" : "Save voice"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setPendingRecordingPath(null);
                                setPendingRecordingName("");
                                setRecordingSavedAs(null);
                                setStep(4);
                              }}
                              className="flex items-center gap-1.5 rounded-lg bg-[#B432FF] px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#9d1cf0]"
                            >
                              Continue
                              <ArrowRight className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setPendingRecordingPath(null);
                                setPendingRecordingName("");
                                setRecordingSavedAs(null);
                                setVoice({ engine: "xtts" });
                              }}
                              className="ml-auto text-[10px] text-[#4A3F60] hover:text-[#8A7FA8]"
                            >
                              Re-record
                            </button>
                          </div>
                        </div>
                      ) : (
                        <VoiceRecorder
                          onCancel={() => setVoiceMode("none")}
                          onRecorded={async (blob) => {
                            setVoiceUploading(true);
                            try {
                              const path = await uploadVoiceClip(blob);
                              setVoice({ engine: "recorded", voiceClipPath: path });
                              setPendingRecordingPath(path);
                              setPendingRecordingName(
                                `My voice ${new Date().toLocaleDateString()}`,
                              );
                              setRecordingSavedAs(null);
                            } catch (e) {
                              setCreationError(
                                e instanceof Error ? e.message : "Voice upload failed"
                              );
                            } finally {
                              setVoiceUploading(false);
                            }
                          }}
                        />
                      )}
                    </div>
                  )}
                </div>
                <div className="mt-5 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-medium text-[#8A7FA8] transition hover:text-[#E0D0F0]"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" /> Back
                  </button>
                  <span className="text-[10px] text-[#4A3F60]">
                    Tap an option to continue
                  </span>
                </div>
              </>
            )}

            {step === 4 && (
              <>
                <PanelHeader
                  title={isInstrumental ? "Your instrumental" : "Beat"}
                  subtitle={
                    isInstrumental
                      ? "Drop your track — this IS the song (no AI vocals)"
                      : "Drop a beat — or skip and use vocals only"
                  }
                />
                <input
                  ref={beatInputRef}
                  type="file"
                  accept="audio/*,.als,.zip"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setBeatFile(f);
                  }}
                />
                {!beatFile ? (
                  <button
                    type="button"
                    onClick={() => beatInputRef.current?.click()}
                    onDragEnter={(e) => {
                      e.preventDefault();
                      setDragActive(true);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragActive(true);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      setDragActive(false);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragActive(false);
                      const f = e.dataTransfer.files?.[0];
                      if (f) setBeatFile(f);
                    }}
                    className={`flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-8 px-4 transition ${
                      dragActive
                        ? "border-[#B432FF] bg-[#B432FF]/5"
                        : "border-[#2A1A4A] hover:border-[#3D2466] hover:bg-[#1A0A2E]/30"
                    }`}
                  >
                    <Upload className="h-5 w-5 text-[#8A7FA8]" />
                    <p className="text-[12px] font-semibold text-[#E0D0F0]">
                      Drop beat here or click to browse
                    </p>
                    <p className="font-mono text-[10px] text-[#4A3F60]">
                      .mp3 · .wav · .flac · .m4a · .als · .zip
                    </p>
                  </button>
                ) : (
                  <div className="flex items-center gap-3 rounded-xl bg-[#1A0A2E] px-3 py-3">
                    <Music className="h-4 w-4 shrink-0 text-[#B432FF]" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-semibold text-[#E0D0F0]">
                        {beatFile.name}
                      </p>
                      <p className="text-[10px] text-[#4A3F60]">
                        {(beatFile.size / (1024 * 1024)).toFixed(2)} MB
                        {/\.als$|\.zip$/i.test(beatFile.name) && (
                          <span className="ml-2 text-[#B432FF]">
                            · auto-renders to WAV
                          </span>
                        )}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setBeatFile(null)}
                      className="rounded-lg p-1.5 text-[#4A3F60] transition hover:bg-[#2A1A4A] hover:text-red-400"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                <div className="mt-5 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(isInstrumental ? 2 : 3)}
                    className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-medium text-[#8A7FA8] transition hover:text-[#E0D0F0]"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" /> Back
                  </button>
                  <button
                    type="button"
                    disabled={(!hasInput && !isInstrumental) || (isInstrumental && !beatFile) || creating}
                    onClick={handleCreate}
                    className="flex items-center gap-2 rounded-xl bg-[#B432FF] px-6 py-3 font-display text-[12px] font-black uppercase tracking-[0.18em] text-white shadow-lg shadow-[#B432FF]/20 transition hover:bg-[#C758FF] disabled:opacity-20 disabled:shadow-none"
                  >
                    <Zap className="h-4 w-4" />
                    Create Song
                  </button>
                </div>
              </>
            )}
          </div>


          {/* Error */}
          {creationError && (
            <div className="mt-5 rounded-xl border border-red-900/30 bg-red-900/5 px-4 py-3 text-[12px] text-red-400/80">
              {creationError}
              <button
                type="button"
                onClick={() => setCreationError(null)}
                className="ml-2 underline hover:text-red-300"
              >
                dismiss
              </button>
            </div>
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
                <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8A7FA8]">
                  Ready to play
                </h2>
                <span className="font-mono text-[10px] text-[#4A3F60]">
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
                <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#4A3F60]">
                  Needs vocal
                </h2>
                <span className="font-mono text-[10px] text-[#2D2640]">
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
                <div key={i} className="h-24 animate-pulse rounded-xl bg-[#0D0A14] border border-[#2A1A4A]" style={{ animationDelay: `${i * 100}ms` }} />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!loadingSongs && songs.length === 0 && (
            <div className="flex flex-col items-center py-16">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#0D0A14]">
                <Mic className="h-5 w-5 text-[#2A1A4A]" />
              </div>
              <p className="text-[12px] text-[#4A3F60]">No songs yet</p>
              <p className="mt-1 text-[11px] text-[#2D2640]">Describe your first song above</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
