/**
 * Upload a recorded voice clip and return the server path for cloning.
 */
export async function uploadVoiceClip(blob: Blob): Promise<string> {
  const form = new FormData();
  form.append("file", blob, "voice_recording.webm");
  const res = await fetch("/api/upload/voice-clip", { method: "POST", body: form });
  if (!res.ok) throw new Error("Voice clip upload failed");
  const data = await res.json();
  return data.voice_clip_path as string;
}
