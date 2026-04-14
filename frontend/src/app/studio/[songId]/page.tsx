'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Save,
  Download,
  Upload,
  Mic,
  RefreshCw,
  Music,
  Layers,
  ChevronDown,
  Loader2,
  Check,
  AlertCircle,
  Play,
  X,
  FileAudio,
  Disc3,
  Pause,
  User,
} from 'lucide-react';
import { useParams } from 'next/navigation';

import WaveformPlayer from '@/components/WaveformPlayer';
import LyricsEditor from '@/components/LyricsEditor';
import {
  getSong,
  updateSong,
  uploadBeat,
  generateSong,
  generateLyrics,
  rewriteLyrics,
  separateStems,
  exportSong,
  getExportDownloadUrl,
  getRenderJobStatus,
  getExportJobStatus,
  listPersonas,
} from '@/lib/api';
import type {
  Song,
  Persona,
  Quality,
  ExportFormat,
  JobStatus,
  UpdateSongRequest,
} from '@/lib/types';

// ─── Types ───────────────────────────────────────────────────────────────────

type StudioJobState =
  | 'idle'
  | 'generating'
  | 'separating'
  | 'exporting'
  | 'uploading';

interface StemEntry {
  id: string;
  stem_type: string;
  url: string;
  muted: boolean;
  solo: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getAudioUrl(song: Song | null): string | null {
  if (!song) return null;
  // Use the API streaming endpoint if song has audio
  if (song.mix_path || song.vocal_path || song.beat_path) {
    return `/api/songs/${song.id}/audio`;
  }
  return null;
}

function getStatusColor(status: string | undefined): string {
  switch (status) {
    case 'completed':
      return 'bg-emerald-500';
    case 'processing':
    case 'pending':
      return 'bg-amber-500';
    case 'failed':
      return 'bg-red-500';
    default:
      return 'bg-zinc-500';
  }
}

function getGenreBadgeColor(genre: string | null): string {
  switch (genre) {
    case 'hip_hop':
      return 'bg-violet-500/20 text-violet-300 ring-violet-500/30';
    case 'melodic_rap':
      return 'bg-pink-500/20 text-pink-300 ring-pink-500/30';
    case 'rnb':
      return 'bg-amber-500/20 text-amber-300 ring-amber-500/30';
    case 'lofi':
      return 'bg-cyan-500/20 text-cyan-300 ring-cyan-500/30';
    default:
      return 'bg-zinc-500/20 text-zinc-300 ring-zinc-500/30';
  }
}

function formatGenre(genre: string | null): string {
  if (!genre) return 'No Genre';
  return genre
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function StudioPage() {
  const params = useParams<{ songId: string }>();
  const songId = params.songId;

  // ── State ────────────────────────────────────────────────────────────────

  const [song, setSong] = useState<Song | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);

  const [quality, setQuality] = useState<Quality>('draft');
  const [jobState, setJobState] = useState<StudioJobState>('idle');
  const [jobMessage, setJobMessage] = useState('');
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const [exportOpen, setExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('wav');
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const [stems, setStems] = useState<StemEntry[]>([]);
  const [stemsOpen, setStemsOpen] = useState(false);

  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selectedPersona, setSelectedPersona] = useState<string>('');

  const [sectionForRegen, setSectionForRegen] = useState<string>('');

  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // ── Data Loading ─────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [songData, personaList] = await Promise.all([
          getSong(songId),
          listPersonas().catch(() => [] as Persona[]),
        ]);
        setSong(songData);
        setTitleDraft(songData.title);
        setPersonas(personaList);

        if (songData.stems && songData.stems.length > 0) {
          setStems(
            songData.stems.map((s) => ({
              ...s,
              muted: false,
              solo: false,
            }))
          );
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load song');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [songId]);

  // ── Job Polling ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!activeJobId || jobState === 'idle') return;

    const interval = setInterval(async () => {
      try {
        let jobStatus: JobStatus = 'pending';
        let jobError: string | null = null;

        if (jobState === 'exporting') {
          const exportJob = await getExportJobStatus(activeJobId);
          jobStatus = exportJob.status;
          jobError = exportJob.error;
          if ((exportJob.status === 'completed' || exportJob.status === 'done') && exportJob.result_path) {
            setDownloadUrl(getExportDownloadUrl(activeJobId));
          }
        } else {
          const renderJob = await getRenderJobStatus(activeJobId);
          jobStatus = renderJob.status;
          jobError = renderJob.error;
          if (renderJob.status === 'completed' || renderJob.status === 'done') {
            // Reload song data when generation completes
            const updated = await getSong(songId);
            setSong(updated);
            if (updated.stems && updated.stems.length > 0) {
              setStems(
                updated.stems.map((s) => ({
                  ...s,
                  muted: false,
                  solo: false,
                }))
              );
            }
          }
        }

        if (jobStatus === 'completed' || jobStatus === 'done' || jobStatus === 'failed') {
          setJobState('idle');
          setActiveJobId(null);
          setJobMessage(
            jobStatus === 'completed'
              ? 'Done!'
              : `Error: ${jobError || 'Unknown error'}`
          );
          setTimeout(() => setJobMessage(''), 5000);
        }
      } catch {
        // silently retry on next poll
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [activeJobId, jobState, songId]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const saveSong = useCallback(
    async (updates: UpdateSongRequest) => {
      if (!song) return;
      try {
        setSaveStatus('saving');
        const updated = await updateSong(songId, updates);
        setSong(updated);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch {
        setSaveStatus('idle');
      }
    },
    [song, songId]
  );

  const handleTitleSave = useCallback(async () => {
    if (titleDraft.trim() && titleDraft !== song?.title) {
      await saveSong({ title: titleDraft.trim() });
    }
    setEditingTitle(false);
  }, [titleDraft, song, saveSong]);

  const handleLyricsUpdate = useCallback(
    (newLyrics: string) => {
      if (!song) return;
      setSong({ ...song, lyrics: newLyrics });
      // Debounced save could go here
    },
    [song]
  );

  const handleLyricsSave = useCallback(() => {
    if (!song) return;
    saveSong({ lyrics: song.lyrics || undefined });
  }, [song, saveSong]);

  const handleGenerateAllLyrics = useCallback(async () => {
    if (!song) return;
    try {
      setJobState('generating');
      setJobMessage('Generating lyrics...');
      const result = await generateLyrics({
        prompt: song.title || 'hip hop track',
        genre: song.genre || undefined,
        mood: song.mood || undefined,
        quality,
      });
      setSong({ ...song, lyrics: result.lyrics });
      await saveSong({ lyrics: result.lyrics });
      setJobState('idle');
      setJobMessage('Lyrics generated!');
      setTimeout(() => setJobMessage(''), 3000);
    } catch (err) {
      setJobState('idle');
      setJobMessage(
        err instanceof Error ? err.message : 'Generation failed'
      );
    }
  }, [song, quality, saveSong]);

  const handleGenerateSection = useCallback(
    async (sectionLabel: string) => {
      if (sectionLabel === 'all') {
        handleGenerateAllLyrics();
        return;
      }
      if (!song) return;
      try {
        setJobState('generating');
        setJobMessage(`Regenerating ${sectionLabel}...`);
        const result = await generateSong({
          song_id: songId,
          prompt: song.title || 'hip hop track',
          quality,
          section: sectionLabel,
        });
        setActiveJobId(result.job_id);
      } catch (err) {
        setJobState('idle');
        setJobMessage(
          err instanceof Error ? err.message : 'Generation failed'
        );
      }
    },
    [song, songId, quality, handleGenerateAllLyrics]
  );

  const handleRewriteSection = useCallback(
    async (sectionLabel: string, instruction: string) => {
      if (!song) return;
      try {
        setJobState('generating');
        setJobMessage(`Rewriting ${sectionLabel}...`);
        const result = await rewriteLyrics({
          song_id: songId,
          original_lyrics: song.lyrics || '',
          instruction,
          quality,
        });
        setSong({ ...song, lyrics: result.lyrics });
        await saveSong({ lyrics: result.lyrics });
        setJobState('idle');
        setJobMessage('Section rewritten!');
        setTimeout(() => setJobMessage(''), 3000);
      } catch (err) {
        setJobState('idle');
        setJobMessage(
          err instanceof Error ? err.message : 'Rewrite failed'
        );
      }
    },
    [song, songId, quality, saveSong]
  );

  const handleGenerateVocal = useCallback(async () => {
    if (!song) return;
    try {
      setJobState('generating');
      setJobMessage('Generating vocal...');
      const result = await generateSong({
        song_id: songId,
        prompt: song.title || 'hip hop track',
        lyrics: song.lyrics || undefined,
        persona_id: selectedPersona || undefined,
        quality,
      });
      setActiveJobId(result.job_id);
    } catch (err) {
      setJobState('idle');
      setJobMessage(
        err instanceof Error ? err.message : 'Vocal generation failed'
      );
    }
  }, [song, songId, quality, selectedPersona]);

  const handleRegenerate = useCallback(async () => {
    if (!song) return;
    try {
      setJobState('generating');
      setJobMessage('Regenerating track...');
      const result = await generateSong({
        song_id: songId,
        prompt: song.title || 'hip hop track',
        lyrics: song.lyrics || undefined,
        persona_id: selectedPersona || undefined,
        quality,
        section: sectionForRegen || undefined,
      });
      setActiveJobId(result.job_id);
    } catch (err) {
      setJobState('idle');
      setJobMessage(
        err instanceof Error ? err.message : 'Regeneration failed'
      );
    }
  }, [song, songId, quality, selectedPersona, sectionForRegen]);

  const handleUploadBeat = useCallback(
    async (file: File) => {
      try {
        setJobState('uploading');
        setJobMessage('Uploading beat...');
        await uploadBeat(songId, file);
        const updated = await getSong(songId);
        setSong(updated);
        setJobState('idle');
        setJobMessage('Beat uploaded!');
        setTimeout(() => setJobMessage(''), 3000);
      } catch (err) {
        setJobState('idle');
        setJobMessage(
          err instanceof Error ? err.message : 'Upload failed'
        );
      }
    },
    [songId]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('audio/')) {
        handleUploadBeat(file);
      }
    },
    [handleUploadBeat]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleUploadBeat(file);
    },
    [handleUploadBeat]
  );

  const handleSeparateStems = useCallback(async () => {
    try {
      setJobState('separating');
      setJobMessage('Separating stems...');
      const result = await separateStems({ song_id: songId });
      setActiveJobId(result.job_id);
    } catch (err) {
      setJobState('idle');
      setJobMessage(
        err instanceof Error ? err.message : 'Stem separation failed'
      );
    }
  }, [songId]);

  const handleExport = useCallback(async () => {
    try {
      setJobState('exporting');
      setJobMessage(`Exporting as ${exportFormat.toUpperCase()}...`);
      setDownloadUrl(null);
      const result = await exportSong({
        song_id: songId,
        format: exportFormat,
      });
      setActiveJobId(result.job_id);
    } catch (err) {
      setJobState('idle');
      setJobMessage(
        err instanceof Error ? err.message : 'Export failed'
      );
    }
  }, [songId, exportFormat]);

  const toggleStemMute = useCallback(
    (stemId: string) => {
      setStems((prev) =>
        prev.map((s) =>
          s.id === stemId ? { ...s, muted: !s.muted } : s
        )
      );
    },
    []
  );

  const toggleStemSolo = useCallback(
    (stemId: string) => {
      setStems((prev) =>
        prev.map((s) =>
          s.id === stemId ? { ...s, solo: !s.solo } : s
        )
      );
    },
    []
  );

  // ── Sections list for dropdown ──────────────────────────────────────────

  const sectionLabels = (() => {
    if (!song?.lyrics) return [];
    const matches = song.lyrics.match(/^\[(.+?)\]$/gm);
    return matches ? matches.map((m) => m.slice(1, -1)) : [];
  })();

  // ── Loading / Error States ──────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-950">
        <div className="flex flex-col items-center gap-4">
          <Disc3 className="w-12 h-12 text-violet-500 animate-spin" />
          <p className="text-zinc-400 text-sm">Loading studio...</p>
        </div>
      </div>
    );
  }

  if (error || !song) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-950">
        <div className="flex flex-col items-center gap-4 text-center">
          <AlertCircle className="w-12 h-12 text-red-400" />
          <p className="text-zinc-200 font-medium">
            Failed to load song
          </p>
          <p className="text-zinc-500 text-sm max-w-md">
            {error || 'Song not found'}
          </p>
        </div>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100">
      {/* ───────── Top Bar ───────── */}
      <header className="flex items-center justify-between h-14 px-4 border-b border-zinc-800 bg-zinc-950 shrink-0">
        <div className="flex items-center gap-4 min-w-0">
          {/* Song Title (editable) */}
          {editingTitle ? (
            <input
              ref={titleInputRef}
              type="text"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleTitleSave();
                if (e.key === 'Escape') {
                  setTitleDraft(song.title);
                  setEditingTitle(false);
                }
              }}
              className="bg-zinc-800 border border-violet-500 rounded-lg px-3 py-1 text-sm font-semibold text-zinc-100 outline-none min-w-[200px]"
              autoFocus
            />
          ) : (
            <button
              onClick={() => {
                setEditingTitle(true);
                setTitleDraft(song.title);
              }}
              className="text-sm font-semibold text-zinc-100 hover:text-white truncate max-w-[300px] transition-colors"
              title="Click to edit title"
            >
              {song.title}
            </button>
          )}

          {/* Genre Badge */}
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ring-1 ring-inset ${getGenreBadgeColor(
              song.genre
            )}`}
          >
            {formatGenre(song.genre)}
          </span>

          {/* BPM */}
          {song.bpm && (
            <span className="text-xs text-zinc-500 font-mono">
              {song.bpm} BPM
            </span>
          )}

          {/* Key */}
          {song.key && (
            <span className="text-xs text-zinc-500 font-mono">
              {song.key}
            </span>
          )}

          {/* Status Dot */}
          <div className="flex items-center gap-1.5">
            <div
              className={`w-2 h-2 rounded-full ${getStatusColor(
                song.updated_at ? 'completed' : undefined
              )}`}
            />
            <span className="text-xs text-zinc-500 capitalize">
              {jobState === 'idle' ? 'Ready' : jobState}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Quality Toggle */}
          <div className="flex items-center bg-zinc-800 rounded-lg p-0.5 border border-zinc-700">
            <button
              onClick={() => setQuality('draft')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors duration-200 ${
                quality === 'draft'
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Draft
            </button>
            <button
              onClick={() => setQuality('render')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors duration-200 ${
                quality === 'render'
                  ? 'bg-violet-600 text-white'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Render
            </button>
          </div>

          {/* Save Button */}
          <button
            onClick={handleLyricsSave}
            disabled={saveStatus === 'saving'}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 transition-colors duration-200"
          >
            {saveStatus === 'saving' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : saveStatus === 'saved' ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            {saveStatus === 'saved' ? 'Saved' : 'Save'}
          </button>

          {/* Export Dropdown */}
          <div className="relative">
            <button
              onClick={() => setExportOpen(!exportOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition-colors duration-200"
            >
              <Download className="w-3.5 h-3.5" />
              Export
              <ChevronDown className="w-3 h-3" />
            </button>

            {exportOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-zinc-800 border border-zinc-700 rounded-xl shadow-xl z-50 py-2">
                <div className="px-3 py-2">
                  <p className="text-xs font-medium text-zinc-400 mb-2">
                    Format
                  </p>
                  <div className="flex gap-2">
                    {(['wav', 'mp3'] as ExportFormat[]).map((fmt) => (
                      <button
                        key={fmt}
                        onClick={() => setExportFormat(fmt)}
                        className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                          exportFormat === fmt
                            ? 'bg-violet-600 border-violet-500 text-white'
                            : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                        }`}
                      >
                        {fmt.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="border-t border-zinc-700 my-1" />
                <div className="px-3 py-2">
                  <button
                    onClick={() => {
                      handleExport();
                      setExportOpen(false);
                    }}
                    disabled={jobState !== 'idle'}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-lg bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export as {exportFormat.toUpperCase()}
                  </button>
                  {downloadUrl && (
                    <a
                      href={downloadUrl}
                      download
                      className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download Ready
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ───────── Main Content ───────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Left Panel: Lyrics Editor (40%) ── */}
        <div className="w-[40%] flex flex-col border-r border-zinc-800 bg-zinc-900">
          <LyricsEditor
            lyrics={song.lyrics || ''}
            onUpdate={handleLyricsUpdate}
            onGenerateSection={handleGenerateSection}
            onRewriteSection={handleRewriteSection}
            isGenerating={jobState === 'generating'}
          />
        </div>

        {/* ── Right Panel: Audio & Controls (60%) ── */}
        <div className="w-[60%] flex flex-col overflow-y-auto bg-zinc-950">
          {/* Waveform Player */}
          <div className="p-4">
            <WaveformPlayer
              audioUrl={getAudioUrl(song)}
              height={100}
              color="#8b5cf6"
            />
          </div>

          {/* Controls */}
          <div className="px-4 pb-4 space-y-4">
            {/* Upload Beat */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              className={`relative rounded-xl border-2 border-dashed p-6 text-center transition-all duration-200 ${
                isDragOver
                  ? 'border-violet-500 bg-violet-500/5'
                  : 'border-zinc-700 hover:border-zinc-600 bg-zinc-900/50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Upload
                className={`w-8 h-8 mx-auto mb-2 transition-colors ${
                  isDragOver ? 'text-violet-400' : 'text-zinc-600'
                }`}
              />
              <p className="text-sm text-zinc-400 mb-1">
                Drag & drop a beat file here
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
              >
                or click to browse
              </button>
              {song.beat_path && (
                <p className="mt-2 text-xs text-emerald-500 flex items-center justify-center gap-1">
                  <FileAudio className="w-3 h-3" />
                  Beat uploaded
                </p>
              )}
            </div>

            {/* Action Buttons Row */}
            <div className="flex gap-3">
              <button
                onClick={handleGenerateVocal}
                disabled={jobState !== 'idle'}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium rounded-xl bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white transition-colors duration-200 shadow-lg shadow-violet-600/20"
              >
                {jobState === 'generating' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Mic className="w-4 h-4" />
                )}
                Generate Vocal
              </button>

              <button
                onClick={handleRegenerate}
                disabled={jobState !== 'idle'}
                className="flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 disabled:opacity-50 text-zinc-300 transition-colors duration-200"
              >
                <RefreshCw className="w-4 h-4" />
                Regenerate
              </button>
            </div>

            {/* Persona Selector + Section Regen */}
            <div className="flex gap-3">
              {/* Persona Selector */}
              {personas.length > 0 && (
                <div className="flex-1">
                  <label className="block text-xs text-zinc-500 mb-1.5">
                    Persona
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <select
                      value={selectedPersona}
                      onChange={(e) => setSelectedPersona(e.target.value)}
                      className="w-full appearance-none bg-zinc-800 border border-zinc-700 focus:border-violet-500 rounded-lg pl-9 pr-8 py-2 text-sm text-zinc-200 outline-none transition-colors cursor-pointer"
                    >
                      <option value="">Default Voice</option>
                      {personas.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
                  </div>
                </div>
              )}

              {/* Section-Level Regeneration */}
              {sectionLabels.length > 0 && (
                <div className="flex-1">
                  <label className="block text-xs text-zinc-500 mb-1.5">
                    Regenerate Section
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Music className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <select
                        value={sectionForRegen}
                        onChange={(e) => setSectionForRegen(e.target.value)}
                        className="w-full appearance-none bg-zinc-800 border border-zinc-700 focus:border-violet-500 rounded-lg pl-9 pr-8 py-2 text-sm text-zinc-200 outline-none transition-colors cursor-pointer"
                      >
                        <option value="">Full Track</option>
                        {sectionLabels.map((label, idx) => (
                          <option key={`${label}-${idx}`} value={label}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
                    </div>
                    <button
                      onClick={handleRegenerate}
                      disabled={jobState !== 'idle'}
                      className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 disabled:opacity-50 text-zinc-300 transition-colors"
                      title="Regenerate selected section"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ── Stems Panel ── */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
              <button
                onClick={() => setStemsOpen(!stemsOpen)}
                className="flex items-center justify-between w-full px-4 py-3 text-sm font-medium text-zinc-300 hover:bg-zinc-800/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-violet-400" />
                  Stems
                  {stems.length > 0 && (
                    <span className="text-xs text-zinc-500">
                      ({stems.length} tracks)
                    </span>
                  )}
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-zinc-500 transition-transform duration-200 ${
                    stemsOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {stemsOpen && (
                <div className="border-t border-zinc-800 px-4 py-3 space-y-3">
                  {stems.length === 0 ? (
                    <div className="text-center py-4">
                      <p className="text-sm text-zinc-500 mb-3">
                        No stems separated yet
                      </p>
                      <button
                        onClick={handleSeparateStems}
                        disabled={jobState !== 'idle' || !getAudioUrl(song)}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white transition-colors"
                      >
                        {jobState === 'separating' ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Layers className="w-4 h-4" />
                        )}
                        Separate Stems
                      </button>
                    </div>
                  ) : (
                    <>
                      {stems.map((stem) => (
                        <div
                          key={stem.id}
                          className="flex items-center gap-3 p-2 rounded-lg bg-zinc-800/50"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-zinc-300 capitalize truncate">
                              {stem.stem_type.replace('_', ' ')}
                            </p>
                          </div>

                          {/* Mini play button */}
                          <button
                            onClick={() => {
                              const audio = new Audio(stem.url);
                              audio.play();
                            }}
                            className="p-1.5 rounded-md bg-zinc-700 hover:bg-zinc-600 text-zinc-300 transition-colors"
                            title="Preview stem"
                          >
                            <Play className="w-3 h-3" />
                          </button>

                          {/* Mute */}
                          <button
                            onClick={() => toggleStemMute(stem.id)}
                            className={`px-2 py-1 text-xs font-bold rounded transition-colors ${
                              stem.muted
                                ? 'bg-red-500/20 text-red-400 ring-1 ring-red-500/30'
                                : 'bg-zinc-700 text-zinc-400 hover:text-zinc-200'
                            }`}
                          >
                            M
                          </button>

                          {/* Solo */}
                          <button
                            onClick={() => toggleStemSolo(stem.id)}
                            className={`px-2 py-1 text-xs font-bold rounded transition-colors ${
                              stem.solo
                                ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30'
                                : 'bg-zinc-700 text-zinc-400 hover:text-zinc-200'
                            }`}
                          >
                            S
                          </button>

                          {/* Download stem */}
                          <a
                            href={stem.url}
                            download
                            className="p-1.5 rounded-md bg-zinc-700 hover:bg-zinc-600 text-zinc-300 transition-colors"
                            title="Download stem"
                          >
                            <Download className="w-3 h-3" />
                          </a>
                        </div>
                      ))}

                      <button
                        onClick={handleSeparateStems}
                        disabled={jobState !== 'idle'}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 disabled:opacity-50 text-zinc-400 transition-colors"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Re-separate
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* ── Export Panel ── */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
              <h3 className="flex items-center gap-2 text-sm font-medium text-zinc-300 mb-3">
                <Download className="w-4 h-4 text-violet-400" />
                Export
              </h3>

              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-xs text-zinc-500 mb-1.5">
                    Format
                  </label>
                  <div className="flex gap-2">
                    {(['wav', 'mp3'] as ExportFormat[]).map((fmt) => (
                      <button
                        key={fmt}
                        onClick={() => setExportFormat(fmt)}
                        className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                          exportFormat === fmt
                            ? 'bg-violet-600/20 border-violet-500 text-violet-300'
                            : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                        }`}
                      >
                        {fmt.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleExport}
                  disabled={jobState !== 'idle' || !getAudioUrl(song)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white transition-colors shadow-lg shadow-violet-600/10"
                >
                  {jobState === 'exporting' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  Export
                </button>
              </div>

              {downloadUrl && (
                <a
                  href={downloadUrl}
                  download
                  className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download {exportFormat.toUpperCase()}
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ───────── Bottom Bar ───────── */}
      <footer className="flex items-center justify-between h-10 px-4 border-t border-zinc-800 bg-zinc-900 shrink-0">
        <div className="flex items-center gap-3">
          {/* Job State Indicator */}
          <div className="flex items-center gap-2">
            {jobState !== 'idle' ? (
              <>
                <Loader2 className="w-3.5 h-3.5 text-violet-400 animate-spin" />
                <span className="text-xs text-violet-400 font-medium capitalize">
                  {jobState}...
                </span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-xs text-zinc-500">Idle</span>
              </>
            )}
          </div>

          {/* Job Message */}
          {jobMessage && (
            <span
              className={`text-xs ${
                jobMessage.startsWith('Error')
                  ? 'text-red-400'
                  : 'text-zinc-400'
              }`}
            >
              {jobMessage}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-zinc-600">
          {song.key && <span>Key: {song.key}</span>}
          {song.bpm && <span>{song.bpm} BPM</span>}
          <span>ID: {song.id.slice(0, 8)}</span>
        </div>
      </footer>

      {/* Click outside export dropdown to close */}
      {exportOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setExportOpen(false)}
        />
      )}
    </div>
  );
}
