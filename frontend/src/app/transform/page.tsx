"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Play,
  Pause,
  Music2,
  Scissors,
  PenLine,
  Sparkles,
  Download,
  Mic2,
  Wand2,
} from "lucide-react";
import FileUploadZone from "@/components/FileUploadZone";
import JobProgress from "@/components/JobProgress";
import {
  createProject,
  createSong,
  uploadSource,
  separateStems,
  alignLyrics,
  rewriteLyrics,
  parodyPipeline,
  exportSong,
  getSong,
  getExportDownloadUrl,
  listPersonas,
} from "@/lib/api";
import type {
  Song,
  Persona,
  RenderJob,
  ExportJob,
  Genre,
  Quality,
  ExportFormat,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Step = 1 | 2 | 3 | 4 | 5;

interface StepState {
  completed: boolean;
  active: boolean;
}

// ---------------------------------------------------------------------------
// Mini Audio Player
// ---------------------------------------------------------------------------

function AudioPlayer({ src, label }: { src: string; label: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  const toggle = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
    } else {
      el.play();
    }
    setPlaying(!playing);
  }, [playing]);

  return (
    <div className="flex items-center gap-3 rounded-lg bg-zinc-800 px-4 py-3">
      <button
        onClick={toggle}
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-violet-600 text-white transition-colors hover:bg-violet-500"
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>
      <span className="truncate text-sm text-zinc-300">{label}</span>
      <audio
        ref={audioRef}
        src={src}
        onEnded={() => setPlaying(false)}
        preload="metadata"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step Header
// ---------------------------------------------------------------------------

function StepHeader({
  number,
  title,
  icon: Icon,
  state,
  onToggle,
}: {
  number: Step;
  title: string;
  icon: typeof Music2;
  state: StepState;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex w-full items-center gap-4 text-left"
    >
      <div
        className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold ${
          state.completed
            ? "bg-green-500/20 text-green-400"
            : state.active
            ? "bg-violet-600 text-white"
            : "bg-zinc-800 text-zinc-500"
        }`}
      >
        {state.completed ? (
          <CheckCircle2 className="h-5 w-5" />
        ) : (
          number
        )}
      </div>
      <Icon
        className={`h-5 w-5 ${
          state.active ? "text-violet-400" : "text-zinc-500"
        }`}
      />
      <span
        className={`flex-1 text-sm font-semibold ${
          state.active ? "text-zinc-100" : "text-zinc-400"
        }`}
      >
        {title}
      </span>
      {state.active ? (
        <ChevronUp className="h-4 w-4 text-zinc-500" />
      ) : (
        <ChevronDown className="h-4 w-4 text-zinc-600" />
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function TransformStudioPage() {
  // -- Workflow state --------------------------------------------------------
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [completedSteps, setCompletedSteps] = useState<Set<Step>>(new Set());

  // -- Step 1 state ----------------------------------------------------------
  const [uploading, setUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{
    name: string;
    size: number;
  } | null>(null);
  const [song, setSong] = useState<Song | null>(null);

  // -- Step 2 state ----------------------------------------------------------
  const [stemMode, setStemMode] = useState<"vocals_instrumental" | "full">(
    "vocals_instrumental"
  );
  const [separating, setSeparating] = useState(false);
  const [separateJobId, setSeparateJobId] = useState<string | null>(null);

  // -- Step 3 state ----------------------------------------------------------
  const [lyricsTab, setLyricsTab] = useState<"transcribe" | "write" | "parody">(
    "write"
  );
  const [lyrics, setLyrics] = useState("");
  const [originalLyrics, setOriginalLyrics] = useState("");
  const [newTheme, setNewTheme] = useState("");
  const [genre, setGenre] = useState<Genre>("hip_hop");
  const [transcribing, setTranscribing] = useState(false);
  const [rewriting, setRewriting] = useState(false);

  // -- Step 4 state ----------------------------------------------------------
  const [quality, setQuality] = useState<Quality>("draft");
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>("");
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [generating, setGenerating] = useState(false);
  const [generateJobId, setGenerateJobId] = useState<string | null>(null);
  const [resultSong, setResultSong] = useState<Song | null>(null);

  // -- Step 5 state ----------------------------------------------------------
  const [exportFormat, setExportFormat] = useState<ExportFormat>("wav");
  const [exporting, setExporting] = useState(false);
  const [exportJobId, setExportJobId] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  // -- Load personas on mount ------------------------------------------------
  useEffect(() => {
    listPersonas()
      .then(setPersonas)
      .catch(() => {});
  }, []);

  // -- Helpers ---------------------------------------------------------------
  function completeStep(step: Step) {
    setCompletedSteps((prev) => new Set(prev).add(step));
    const next = (step + 1) as Step;
    if (next <= 5) setCurrentStep(next);
  }

  function stepState(step: Step): StepState {
    return {
      completed: completedSteps.has(step),
      active: currentStep === step,
    };
  }

  // -- Step 1: Upload --------------------------------------------------------
  const handleUpload = useCallback(async (file: File) => {
    setUploading(true);
    try {
      const project = await createProject({
        title: `Transform: ${file.name}`,
        user_id: "default",
      });
      const newSong = await createSong({
        title: file.name.replace(/\.[^.]+$/, ""),
        project_id: project.id,
      });
      await uploadSource(newSong.id, file);
      const refreshed = await getSong(newSong.id);
      setSong(refreshed);
      setUploadedFile({ name: file.name, size: file.size });
      completeStep(1);
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setUploading(false);
    }
  }, []);

  // -- Step 2: Separate ------------------------------------------------------
  async function handleSeparate() {
    if (!song) return;
    setSeparating(true);
    try {
      const res = await separateStems({
        song_id: song.id,
        mode: stemMode,
        full_stems: stemMode === "full",
      });
      setSeparateJobId(res.job_id);
    } catch (err) {
      console.error("Separate failed:", err);
      setSeparating(false);
    }
  }

  async function onSeparateComplete() {
    if (!song) return;
    const refreshed = await getSong(song.id);
    setSong(refreshed);
    setSeparating(false);
    setSeparateJobId(null);
    completeStep(2);
  }

  // -- Step 3: Lyrics --------------------------------------------------------
  async function handleTranscribe() {
    if (!song) return;
    setTranscribing(true);
    try {
      const res = await alignLyrics({ song_id: song.id, lyrics: "" });
      const text = res.sections.map((s) => s.lyrics || "").join("\n\n");
      setLyrics(text);
      setOriginalLyrics(text);
    } catch (err) {
      console.error("Transcribe failed:", err);
    } finally {
      setTranscribing(false);
    }
  }

  async function handleParodyRewrite() {
    if (!song || !originalLyrics) return;
    setRewriting(true);
    try {
      const res = await rewriteLyrics({
        song_id: song.id,
        original_lyrics: originalLyrics,
        new_theme: newTheme || undefined,
        quality,
      });
      setLyrics(res.lyrics);
    } catch (err) {
      console.error("Rewrite failed:", err);
    } finally {
      setRewriting(false);
    }
  }

  function handleLyricsDone() {
    if (lyrics.trim()) completeStep(3);
  }

  // -- Step 4: Generate ------------------------------------------------------
  async function handleGenerate() {
    if (!song) return;
    setGenerating(true);
    try {
      const res = await parodyPipeline({
        song_id: song.id,
        quality,
        new_lyrics: lyrics,
        mode: "full",
        full_stems: stemMode === "full",
      });
      setGenerateJobId(res.job_id);
    } catch (err) {
      console.error("Generate failed:", err);
      setGenerating(false);
    }
  }

  async function onGenerateComplete() {
    if (!song) return;
    const refreshed = await getSong(song.id);
    setResultSong(refreshed);
    setGenerating(false);
    setGenerateJobId(null);
    completeStep(4);
  }

  // -- Step 5: Export --------------------------------------------------------
  async function handleExport(format: ExportFormat) {
    if (!song) return;
    setExportFormat(format);
    setExporting(true);
    try {
      const res = await exportSong({ song_id: song.id, format });
      setExportJobId(res.job_id);
    } catch (err) {
      console.error("Export failed:", err);
      setExporting(false);
    }
  }

  function onExportComplete(result: RenderJob | ExportJob) {
    const exportResult = result as ExportJob;
    if (exportResult.result_path) {
      setDownloadUrl(getExportDownloadUrl(exportResult.id));
    } else {
      setDownloadUrl(getExportDownloadUrl(exportResult.id));
    }
    setExporting(false);
    setExportJobId(null);
    completeStep(5);
  }

  // -- Genre options ---------------------------------------------------------
  const genres: { value: Genre; label: string }[] = [
    { value: "hip_hop", label: "Hip Hop" },
    { value: "melodic_rap", label: "Melodic Rap" },
    { value: "rnb", label: "R&B" },
    { value: "lofi", label: "Lo-Fi" },
  ];

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-zinc-100">
            Transform Studio
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Upload any track, separate stems, write new lyrics, and create your
            parody.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {/* ============================================================= */}
          {/* STEP 1 — Upload Source */}
          {/* ============================================================= */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
            <StepHeader
              number={1}
              title="Upload Source"
              icon={Music2}
              state={stepState(1)}
              onToggle={() => setCurrentStep(1)}
            />
            {currentStep === 1 && (
              <div className="mt-5">
                <FileUploadZone
                  onUpload={handleUpload}
                  accept="audio/*"
                  label="Drop your source track here (any song or beat)"
                  loading={uploading}
                  uploadedFile={uploadedFile}
                />
              </div>
            )}
          </div>

          {/* ============================================================= */}
          {/* STEP 2 — Separate Stems */}
          {/* ============================================================= */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
            <StepHeader
              number={2}
              title="Separate Stems"
              icon={Scissors}
              state={stepState(2)}
              onToggle={() =>
                completedSteps.has(1) && setCurrentStep(2)
              }
            />
            {currentStep === 2 && (
              <div className="mt-5 flex flex-col gap-4">
                {/* Stem mode toggle */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setStemMode("vocals_instrumental")}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                      stemMode === "vocals_instrumental"
                        ? "bg-violet-600 text-white"
                        : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                    }`}
                  >
                    2 Stems
                  </button>
                  <button
                    onClick={() => setStemMode("full")}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                      stemMode === "full"
                        ? "bg-violet-600 text-white"
                        : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                    }`}
                  >
                    4 Stems (Full)
                  </button>
                </div>

                {/* Separate button or progress */}
                {separateJobId ? (
                  <JobProgress
                    jobId={separateJobId}
                    jobType="render"
                    onComplete={onSeparateComplete}
                  />
                ) : (
                  <button
                    onClick={handleSeparate}
                    disabled={separating || !song}
                    className="flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
                  >
                    <Scissors className="h-4 w-4" />
                    Separate Stems
                  </button>
                )}

                {/* Show stems if already separated */}
                {song?.stems && song.stems.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                      Stems
                    </p>
                    {song.stems.map((stem) => (
                      <AudioPlayer
                        key={stem.id}
                        src={stem.url}
                        label={stem.stem_type}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ============================================================= */}
          {/* STEP 3 — Write Parody Lyrics */}
          {/* ============================================================= */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
            <StepHeader
              number={3}
              title="Write Parody Lyrics"
              icon={PenLine}
              state={stepState(3)}
              onToggle={() =>
                completedSteps.has(2) && setCurrentStep(3)
              }
            />
            {currentStep === 3 && (
              <div className="mt-5 flex flex-col gap-4">
                {/* Tab switcher */}
                <div className="flex gap-1 rounded-lg bg-zinc-800 p-1">
                  {(
                    [
                      { key: "transcribe", label: "Transcribe", icon: Mic2 },
                      { key: "write", label: "Write", icon: PenLine },
                      { key: "parody", label: "AI Parody", icon: Wand2 },
                    ] as const
                  ).map(({ key, label, icon: TabIcon }) => (
                    <button
                      key={key}
                      onClick={() => setLyricsTab(key)}
                      className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                        lyricsTab === key
                          ? "bg-zinc-700 text-white"
                          : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      <TabIcon className="h-3.5 w-3.5" />
                      {label}
                    </button>
                  ))}
                </div>

                {/* Transcribe tab */}
                {lyricsTab === "transcribe" && (
                  <div className="flex flex-col gap-3">
                    <p className="text-xs text-zinc-500">
                      Extract lyrics from the original track using AI alignment.
                    </p>
                    <button
                      onClick={handleTranscribe}
                      disabled={transcribing}
                      className="flex items-center justify-center gap-2 rounded-lg bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-700 disabled:opacity-50"
                    >
                      <Mic2 className="h-4 w-4" />
                      {transcribing ? "Transcribing..." : "Transcribe Original"}
                    </button>
                    {lyrics && (
                      <textarea
                        value={lyrics}
                        onChange={(e) => setLyrics(e.target.value)}
                        rows={10}
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:border-violet-500 focus:outline-none"
                        placeholder="Transcribed lyrics will appear here..."
                      />
                    )}
                  </div>
                )}

                {/* Write tab */}
                {lyricsTab === "write" && (
                  <textarea
                    value={lyrics}
                    onChange={(e) => setLyrics(e.target.value)}
                    rows={12}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:border-violet-500 focus:outline-none"
                    placeholder="Write your new lyrics here..."
                  />
                )}

                {/* Parody rewrite tab */}
                {lyricsTab === "parody" && (
                  <div className="flex flex-col gap-3">
                    <textarea
                      value={originalLyrics}
                      onChange={(e) => setOriginalLyrics(e.target.value)}
                      rows={6}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:border-violet-500 focus:outline-none"
                      placeholder="Paste the original lyrics here..."
                    />
                    <input
                      value={newTheme}
                      onChange={(e) => setNewTheme(e.target.value)}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:border-violet-500 focus:outline-none"
                      placeholder="New theme (e.g. pizza delivery, space exploration...)"
                    />
                    <button
                      onClick={handleParodyRewrite}
                      disabled={rewriting || !originalLyrics.trim()}
                      className="flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
                    >
                      <Wand2 className="h-4 w-4" />
                      {rewriting ? "Rewriting..." : "AI Parody Rewrite"}
                    </button>
                    {lyrics && (
                      <>
                        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                          Rewritten Lyrics
                        </p>
                        <textarea
                          value={lyrics}
                          onChange={(e) => setLyrics(e.target.value)}
                          rows={8}
                          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-200 focus:border-violet-500 focus:outline-none"
                        />
                      </>
                    )}
                  </div>
                )}

                {/* Genre selector */}
                <div className="flex flex-wrap gap-2">
                  {genres.map((g) => (
                    <button
                      key={g.value}
                      onClick={() => setGenre(g.value)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        genre === g.value
                          ? "bg-violet-600 text-white"
                          : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                      }`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>

                {/* Done button */}
                <button
                  onClick={handleLyricsDone}
                  disabled={!lyrics.trim()}
                  className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
                >
                  Continue with these lyrics
                </button>
              </div>
            )}
          </div>

          {/* ============================================================= */}
          {/* STEP 4 — Generate */}
          {/* ============================================================= */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
            <StepHeader
              number={4}
              title="Generate Parody"
              icon={Sparkles}
              state={stepState(4)}
              onToggle={() =>
                completedSteps.has(3) && setCurrentStep(4)
              }
            />
            {currentStep === 4 && (
              <div className="mt-5 flex flex-col gap-4">
                {/* Quality toggle */}
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
                    Quality
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setQuality("draft")}
                      className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                        quality === "draft"
                          ? "bg-violet-600 text-white"
                          : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                      }`}
                    >
                      Draft (fast)
                    </button>
                    <button
                      onClick={() => setQuality("render")}
                      className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                        quality === "render"
                          ? "bg-violet-600 text-white"
                          : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                      }`}
                    >
                      Render (HQ)
                    </button>
                  </div>
                </div>

                {/* Persona selector */}
                {personas.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
                      Persona (optional)
                    </p>
                    <select
                      value={selectedPersonaId}
                      onChange={(e) => setSelectedPersonaId(e.target.value)}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-zinc-200 focus:border-violet-500 focus:outline-none"
                    >
                      <option value="">No persona</option>
                      {personas.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                          {p.style_mode ? ` (${p.style_mode})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Generate button or progress */}
                {generateJobId ? (
                  <JobProgress
                    jobId={generateJobId}
                    jobType="render"
                    onComplete={onGenerateComplete}
                  />
                ) : (
                  <button
                    onClick={handleGenerate}
                    disabled={generating}
                    className="flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
                  >
                    <Sparkles className="h-4 w-4" />
                    Create Parody
                  </button>
                )}

                {/* Result: side-by-side players */}
                {resultSong && (
                  <div className="flex flex-col gap-3">
                    <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                      Result
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {resultSong.stems
                        ?.filter((s) => s.stem_type === "instrumental")
                        .map((s) => (
                          <AudioPlayer
                            key={s.id}
                            src={s.url}
                            label="Original Instrumental"
                          />
                        ))}
                      {resultSong.vocal_path && (
                        <AudioPlayer
                          src={`/api/songs/${resultSong.id}/audio`}
                          label="New Parody Mix"
                        />
                      )}
                    </div>
                    {resultSong.mix_path && (
                      <AudioPlayer
                        src={`/api/songs/${resultSong.id}/audio`}
                        label="Full Mix"
                      />
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ============================================================= */}
          {/* STEP 5 — Export */}
          {/* ============================================================= */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
            <StepHeader
              number={5}
              title="Export"
              icon={Download}
              state={stepState(5)}
              onToggle={() =>
                completedSteps.has(4) && setCurrentStep(5)
              }
            />
            {currentStep === 5 && (
              <div className="mt-5 flex flex-col gap-4">
                {exportJobId ? (
                  <JobProgress
                    jobId={exportJobId}
                    jobType="export"
                    onComplete={onExportComplete}
                  />
                ) : downloadUrl ? (
                  <div className="flex flex-col items-center gap-3 rounded-lg bg-green-500/10 p-6">
                    <CheckCircle2 className="h-8 w-8 text-green-500" />
                    <p className="text-sm font-medium text-green-400">
                      Export ready!
                    </p>
                    <a
                      href={downloadUrl}
                      download
                      className="flex items-center gap-2 rounded-lg bg-green-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-500"
                    >
                      <Download className="h-4 w-4" />
                      Download {exportFormat.toUpperCase()}
                    </a>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleExport("wav")}
                      disabled={exporting}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
                    >
                      <Download className="h-4 w-4" />
                      Export WAV
                    </button>
                    <button
                      onClick={() => handleExport("mp3")}
                      disabled={exporting}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-5 py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-700 disabled:opacity-50"
                    >
                      <Download className="h-4 w-4" />
                      Export MP3
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
