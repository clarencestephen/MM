import type {
  Project,
  Song,
  Persona,
  RenderJob,
  ExportJob,
  CreateProjectRequest,
  CreateSongRequest,
  UpdateSongRequest,
  CreatePersonaRequest,
  GenerateSongRequest,
  GenerateSongResponse,
  GenerateLyricsRequest,
  GenerateLyricsResponse,
  RewriteLyricsRequest,
  RewriteLyricsResponse,
  SeparateStemsRequest,
  SeparateStemsResponse,
  ParodyPipelineRequest,
  ParodyPipelineResponse,
  AlignLyricsRequest,
  AlignLyricsResponse,
  ExportRequest,
  ExportResponse,
  UploadResponse,
  HealthResponse,
} from "./types";

// ─── Configuration ───────────────────────────────────────────────────────────

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

// ─── Error Handling ──────────────────────────────────────────────────────────

export class ApiClientError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = "ApiClientError";
    this.status = status;
    this.detail = detail;
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let detail = `Request failed with status ${response.status}`;
    try {
      const body = await response.json();
      if (body.detail) {
        detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
      }
    } catch {
      // body was not JSON — keep default message
    }
    throw new ApiClientError(response.status, detail);
  }
  return response.json() as Promise<T>;
}

// ─── Fetch Helpers ───────────────────────────────────────────────────────────

function jsonHeaders(): HeadersInit {
  return { "Content-Type": "application/json" };
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  return handleResponse<T>(res);
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(body),
  });
  return handleResponse<T>(res);
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "PATCH",
    headers: jsonHeaders(),
    body: JSON.stringify(body),
  });
  return handleResponse<T>(res);
}

async function upload<T>(path: string, formData: FormData): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    body: formData,
  });
  return handleResponse<T>(res);
}

// ─── Projects ────────────────────────────────────────────────────────────────

export async function createProject(data: CreateProjectRequest): Promise<Project> {
  return post<Project>("/api/projects/", data);
}

export async function listProjects(): Promise<Project[]> {
  return get<Project[]>("/api/projects/");
}

export async function getProject(id: string): Promise<Project> {
  return get<Project>(`/api/projects/${id}`);
}

// ─── Songs ───────────────────────────────────────────────────────────────────

export async function createSong(data: CreateSongRequest): Promise<Song> {
  return post<Song>("/api/songs/", data);
}

export async function getSong(id: string): Promise<Song> {
  return get<Song>(`/api/songs/${id}`);
}

export async function updateSong(id: string, data: UpdateSongRequest): Promise<Song> {
  return patch<Song>(`/api/songs/${id}`, data);
}

export async function listSongsByProject(projectId: string): Promise<Song[]> {
  return get<Song[]>(`/api/songs/project/${projectId}`);
}

export async function deleteSong(id: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/songs/${id}`, { method: "DELETE" });
  if (!res.ok) throw new ApiClientError(res.status, "Failed to delete song");
}

export function getSongAudioUrl(songId: string): string {
  return `${BASE_URL}/api/songs/${songId}/audio`;
}

// ─── File Uploads ────────────────────────────────────────────────────────────

export async function uploadBeat(songId: string, file: File): Promise<UploadResponse> {
  const form = new FormData();
  form.append("song_id", songId);
  form.append("file", file);
  return upload<UploadResponse>("/api/upload/beat", form);
}

export async function uploadSource(songId: string, file: File): Promise<UploadResponse> {
  const form = new FormData();
  form.append("song_id", songId);
  form.append("file", file);
  return upload<UploadResponse>("/api/upload/source", form);
}

export async function uploadVocal(songId: string, file: File): Promise<UploadResponse> {
  const form = new FormData();
  form.append("song_id", songId);
  form.append("file", file);
  return upload<UploadResponse>("/api/upload/vocal", form);
}

// ─── Generation ──────────────────────────────────────────────────────────────

export async function generateSong(data: GenerateSongRequest): Promise<GenerateSongResponse> {
  return post<GenerateSongResponse>("/api/generate/", data);
}

export async function generateLyrics(data: GenerateLyricsRequest): Promise<GenerateLyricsResponse> {
  return post<GenerateLyricsResponse>("/api/generate/lyrics", data);
}

export async function rewriteLyrics(data: RewriteLyricsRequest): Promise<RewriteLyricsResponse> {
  return post<RewriteLyricsResponse>("/api/generate/rewrite", data);
}

// ─── Transform ───────────────────────────────────────────────────────────────

export async function separateStems(data: SeparateStemsRequest): Promise<SeparateStemsResponse> {
  return post<SeparateStemsResponse>("/api/transform/separate", data);
}

export async function parodyPipeline(data: ParodyPipelineRequest): Promise<ParodyPipelineResponse> {
  return post<ParodyPipelineResponse>("/api/transform/parody", data);
}

export async function alignLyrics(data: AlignLyricsRequest): Promise<AlignLyricsResponse> {
  return post<AlignLyricsResponse>("/api/transform/align", data);
}

// ─── Personas ────────────────────────────────────────────────────────────────

export async function createPersona(data: CreatePersonaRequest): Promise<Persona> {
  return post<Persona>("/api/personas/", data);
}

export async function listPersonas(): Promise<Persona[]> {
  return get<Persona[]>("/api/personas/");
}

export async function getPersona(id: string): Promise<Persona> {
  return get<Persona>(`/api/personas/${id}`);
}

export async function uploadVoiceSample(personaId: string, file: File): Promise<UploadResponse> {
  const form = new FormData();
  form.append("file", file);
  return upload<UploadResponse>(`/api/personas/${personaId}/voice-sample`, form);
}

// ─── Export ──────────────────────────────────────────────────────────────────

export async function exportSong(data: ExportRequest): Promise<ExportResponse> {
  return post<ExportResponse>("/api/export/", data);
}

export function getExportDownloadUrl(jobId: string): string {
  return `${BASE_URL}/api/export/download/${jobId}`;
}

// ─── Job Status ──────────────────────────────────────────────────────────────

export async function getRenderJobStatus(jobId: string): Promise<RenderJob> {
  return get<RenderJob>(`/api/jobs/render/${jobId}`);
}

export async function getExportJobStatus(jobId: string): Promise<ExportJob> {
  return get<ExportJob>(`/api/jobs/export/${jobId}`);
}

// ─── Health ──────────────────────────────────────────────────────────────────

export async function healthCheck(): Promise<HealthResponse> {
  return get<HealthResponse>("/health");
}

// ─── MMMM Studio ────────────────────────────────────────────────────────────

import type {
  StudioSession,
  StudioSessionListItem,
  StudioTrack,
  CreateStudioSessionRequest,
  UpdateStudioSessionRequest,
  CreateStudioTrackRequest,
  UpdateStudioTrackRequest,
  SubscriptionStatus,
  TierLimits,
} from "./types";

export async function createStudioSession(data: CreateStudioSessionRequest): Promise<StudioSession> {
  return post<StudioSession>("/api/studio/sessions/", data);
}

export async function listStudioSessions(projectId?: string): Promise<StudioSessionListItem[]> {
  const q = projectId ? `?project_id=${projectId}` : "";
  return get<StudioSessionListItem[]>(`/api/studio/sessions/${q}`);
}

export async function getStudioSession(id: string): Promise<StudioSession> {
  return get<StudioSession>(`/api/studio/sessions/${id}`);
}

export async function updateStudioSession(id: string, data: UpdateStudioSessionRequest): Promise<StudioSession> {
  return patch<StudioSession>(`/api/studio/sessions/${id}`, data);
}

export async function deleteStudioSession(id: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/studio/sessions/${id}`, { method: "DELETE" });
  if (!res.ok) throw new ApiClientError(res.status, "Failed to delete session");
}

export async function addStudioTrack(sessionId: string, data: CreateStudioTrackRequest): Promise<StudioTrack> {
  return post<StudioTrack>(`/api/studio/sessions/${sessionId}/tracks`, data);
}

export async function updateStudioTrack(trackId: string, data: UpdateStudioTrackRequest): Promise<StudioTrack> {
  return patch<StudioTrack>(`/api/studio/tracks/${trackId}`, data);
}

export async function deleteStudioTrack(trackId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/studio/tracks/${trackId}`, { method: "DELETE" });
  if (!res.ok) throw new ApiClientError(res.status, "Failed to delete track");
}

export async function uploadTrackAudio(trackId: string, file: File | Blob, filename?: string): Promise<StudioTrack> {
  const form = new FormData();
  form.append("file", file, filename || "audio.webm");
  return upload<StudioTrack>(`/api/studio/tracks/${trackId}/upload`, form);
}

export async function recordTrackAudio(trackId: string, blob: Blob): Promise<StudioTrack> {
  const form = new FormData();
  form.append("file", blob, "recording.webm");
  return upload<StudioTrack>(`/api/studio/tracks/${trackId}/record`, form);
}

export function getTrackAudioUrl(trackId: string, version: "processed" | "raw" = "processed"): string {
  return `${BASE_URL}/api/studio/tracks/${trackId}/audio?version=${version}`;
}

export async function getSubscriptionStatus(): Promise<SubscriptionStatus> {
  return get<SubscriptionStatus>("/api/studio/subscription/status");
}

export async function getTierLimits(): Promise<TierLimits> {
  return get<TierLimits>("/api/studio/subscription/limits");
}
