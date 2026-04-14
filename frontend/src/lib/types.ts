// ─── Enums & Literals ────────────────────────────────────────────────────────

export type Quality = "draft" | "render";
export type Genre = "hip_hop" | "melodic_rap" | "rnb" | "lofi";
export type Mood = string;
export type MusicalKey = string;
export type ExportFormat = "wav" | "mp3";
export type StemMode = "vocals_instrumental" | "full";
export type ParodyMode = "full" | "vocals_only";
export type JobStatus = "pending" | "processing" | "completed" | "done" | "running" | "failed";
export type StyleMode = string;

// ─── Core Domain Models ──────────────────────────────────────────────────────

export interface Project {
  id: string;
  title: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface Song {
  id: string;
  title: string;
  prompt: string | null;
  lyrics: string | null;
  genre: Genre | null;
  mood: Mood | null;
  bpm: number | null;
  key: MusicalKey | null;
  status: string;
  project_id: string;
  beat_path: string | null;
  vocal_path: string | null;
  mix_path: string | null;
  stems: Stem[] | null;
  sections: Section[] | null;
  created_at: string;
  updated_at: string;
}

export interface Persona {
  id: string;
  name: string;
  description: string | null;
  style_mode: StyleMode | null;
  user_id: string;
  voice_sample_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Stem {
  id: string;
  song_id: string;
  stem_type: string;
  url: string;
  created_at: string;
}

export interface Section {
  id: string;
  song_id: string;
  name: string;
  start_time: number;
  end_time: number;
  lyrics: string | null;
}

export interface RenderJob {
  id: string;
  job_type: string;
  status: JobStatus;
  result_path: string | null;
  error: string | null;
  created_at: string | null;
}

export interface ExportJob {
  id: string;
  job_type: string;
  status: JobStatus;
  result_path: string | null;
  error: string | null;
  created_at: string | null;
}

// ─── Request Types ───────────────────────────────────────────────────────────

export interface CreateProjectRequest {
  title: string;
  user_id: string;
}

export interface CreateSongRequest {
  title: string;
  lyrics?: string;
  genre?: Genre;
  mood?: Mood;
  bpm?: number;
  key?: MusicalKey;
  project_id: string;
}

export interface UpdateSongRequest {
  title?: string;
  lyrics?: string;
  genre?: Genre;
  mood?: Mood;
  bpm?: number;
  key?: MusicalKey;
}

export interface CreatePersonaRequest {
  name: string;
  description?: string;
  style_mode?: StyleMode;
  user_id: string;
}

export interface GenerateSongRequest {
  song_id: string;
  prompt: string;
  lyrics?: string;
  persona_id?: string;
  quality?: Quality;
  section?: string;
  voice_engine?: string;
  azure_voice?: string;
  voice_clip_path?: string;
}

export interface GenerateLyricsRequest {
  prompt: string;
  genre?: Genre;
  mood?: Mood;
  quality?: Quality;
}

export interface RewriteLyricsRequest {
  song_id: string;
  original_lyrics: string;
  new_theme?: string;
  instruction?: string;
  quality?: Quality;
}

export interface SeparateStemsRequest {
  song_id: string;
  mode?: StemMode;
  full_stems?: boolean;
}

export interface ParodyPipelineRequest {
  song_id: string;
  mode?: ParodyMode;
  quality?: Quality;
  new_lyrics?: string;
  full_stems?: boolean;
}

export interface AlignLyricsRequest {
  song_id: string;
  lyrics: string;
}

export interface ExportRequest {
  song_id: string;
  format: ExportFormat;
}

// ─── Response Types ──────────────────────────────────────────────────────────

export interface GenerateLyricsResponse {
  lyrics: string;
  genre: Genre | null;
  mood: Mood | null;
}

export interface GenerateSongResponse {
  job_id: string;
  song_id: string;
  status: string;
  quality: string;
}

export interface RewriteLyricsResponse {
  lyrics: string;
  original_lyrics: string;
}

export interface SeparateStemsResponse {
  job_id: string;
  status: JobStatus;
}

export interface ParodyPipelineResponse {
  job_id: string;
  status: JobStatus;
}

export interface AlignLyricsResponse {
  song_id: string;
  sections: Section[];
}

export interface ExportResponse {
  job_id: string;
  status: JobStatus;
  format: ExportFormat;
}

export interface UploadResponse {
  file_id: string;
  file_path: string;
  file_type: string;
  song_id: string;
}

export interface GpuInfo {
  gpu: number;
  name: string;
  vram_used_gb: number;
  vram_total_gb: number;
  utilization_pct: number;
}

export interface HealthResponse {
  status: string;
  services?: {
    ollama?: boolean;
    ffmpeg?: boolean;
    database?: boolean;
  };
  models?: Record<string, boolean>;
  gpu?: GpuInfo[];
}

export interface ApiError {
  detail: string;
}

// ─── MMMM Studio Types ─────────────────────────────────────────────────────

export type TrackType = "recording" | "midi" | "import" | "generated";
export type SessionStatus = "draft" | "mixing" | "exported";
export type SubscriptionTier = "free" | "pro";

export interface StudioTrack {
  id: string;
  name: string;
  order_index: number;
  track_type: TrackType;
  instrument_label: string | null;
  raw_audio_path: string | null;
  processed_audio_path: string | null;
  duration_seconds: number | null;
  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;
  color: string;
  pitch_shift_semitones: number;
  tempo_stretch_ratio: number;
  detected_key: string | null;
  detected_bpm: number | null;
  session_id: string;
}

export interface ArrangementSection {
  id: string;
  label: string;
  order_index: number;
  start_bar: number;
  length_bars: number;
  color: string;
  session_id: string;
}

export interface StudioSession {
  id: string;
  title: string;
  bpm: number;
  key: string;
  scale: string;
  time_signature: string;
  status: SessionStatus;
  genre: string | null;
  master_mix_path: string | null;
  project_id: string;
  song_id: string | null;
  tracks: StudioTrack[];
  arrangement_sections: ArrangementSection[];
}

export interface StudioSessionListItem {
  id: string;
  title: string;
  bpm: number;
  key: string;
  status: SessionStatus;
  genre: string | null;
  project_id: string;
  track_count: number;
}

export interface CreateStudioSessionRequest {
  title: string;
  bpm?: number;
  key?: string;
  scale?: string;
  time_signature?: string;
  genre?: string;
  project_id: string;
}

export interface UpdateStudioSessionRequest {
  title?: string;
  bpm?: number;
  key?: string;
  scale?: string;
  time_signature?: string;
  genre?: string;
}

export interface CreateStudioTrackRequest {
  name?: string;
  track_type?: TrackType;
  instrument_label?: string;
  color?: string;
}

export interface UpdateStudioTrackRequest {
  name?: string;
  instrument_label?: string;
  volume?: number;
  pan?: number;
  muted?: boolean;
  solo?: boolean;
  color?: string;
}

export interface SubscriptionStatus {
  tier: SubscriptionTier;
  status: string;
  current_period_end: string | null;
}

export interface TierLimits {
  tier: SubscriptionTier;
  limits: {
    max_tracks: number;
    custom_instrument_prompts: boolean;
    key_tempo_sync: boolean;
    export_formats: string[];
    sample_library_limit: number;
    preset_instruments: string[] | null;
  };
}
