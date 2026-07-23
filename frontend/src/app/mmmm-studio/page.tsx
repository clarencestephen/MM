"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Music, Trash2, ArrowRight, Loader2 } from "lucide-react";
import {
  listProjects,
  createProject,
  listStudioSessions,
  createStudioSession,
  deleteStudioSession,
} from "@/lib/api";
import type { StudioSessionListItem, Project } from "@/lib/types";

export default function MMMStudioPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<StudioSessionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [bpm, setBpm] = useState(120);
  const [key, setKey] = useState("C");
  const [showCreate, setShowCreate] = useState(false);

  const loadSessions = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listStudioSessions();
      setSessions(data);
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleCreate = async () => {
    if (!title.trim()) return;
    setCreating(true);
    try {
      // Ensure a project exists
      let projects: Project[] = [];
      try {
        projects = await listProjects();
      } catch { /* empty */ }

      let projectId: string;
      if (projects.length > 0) {
        projectId = projects[0].id;
      } else {
        const project = await createProject({
          title: "MMMM Studio",
          user_id: "default-user",
        });
        projectId = project.id;
      }

      const session = await createStudioSession({
        title: title.trim(),
        bpm,
        key,
        project_id: projectId,
      });
      router.push(`/mmmm-studio/${session.id}`);
    } catch {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen pb-32">
      {/* Header */}
      <div className="mx-auto max-w-2xl px-5 pt-12 pb-8 sm:px-6">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#B432FF]">
            MMMM
          </span>
        </div>
        <h1 className="font-display text-[36px] font-light italic leading-tight tracking-tight text-[#E0D0F0]">
          Studio
        </h1>
        <p className="mt-2 text-[13px] text-[#8A7FA8]">
          Record, layer, and transform sounds into songs. Hum a melody, tap a rhythm,
          describe the instrument — AI does the rest.
        </p>
      </div>

      <div className="mx-auto max-w-2xl px-5 sm:px-6">
        {/* Create button */}
        {!showCreate ? (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="mb-6 flex w-full items-center justify-center gap-2 rounded-xl border border-[#B432FF]/20 bg-[#B432FF]/[0.04] py-4 text-[13px] font-semibold text-[#B432FF] transition hover:bg-[#B432FF]/[0.08]"
          >
            <Plus className="h-4 w-4" />
            New Session
          </button>
        ) : (
          <div className="mb-6 rounded-xl border border-[#2A1A4A] bg-[#0D0A14] p-5">
            <h3 className="mb-4 text-[13px] font-semibold text-[#E0D0F0]">New Studio Session</h3>
            <div className="space-y-3">
              <input
                autoFocus
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Session name..."
                className="w-full rounded-lg border border-[#2A1A4A] bg-[#1A0A2E] px-4 py-2.5 text-[14px] text-[#E0D0F0] placeholder-[#4A3F60] outline-none focus:border-[#B432FF]/30"
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#4A3F60]">BPM</label>
                  <input
                    type="number"
                    min={40}
                    max={300}
                    value={bpm}
                    onChange={(e) => setBpm(Number(e.target.value))}
                    className="w-16 rounded-md border border-[#2A1A4A] bg-[#1A0A2E] px-2 py-1.5 text-center text-[13px] font-mono text-[#E0D0F0] outline-none focus:border-[#B432FF]/30"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#4A3F60]">Key</label>
                  <select
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    className="rounded-md border border-[#2A1A4A] bg-[#1A0A2E] px-2 py-1.5 text-[13px] font-mono text-[#E0D0F0] outline-none focus:border-[#B432FF]/30"
                  >
                    {["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"].map((k) => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!title.trim() || creating}
                  onClick={handleCreate}
                  className="flex items-center gap-2 rounded-lg bg-[#B432FF] px-4 py-2 text-[12px] font-bold text-white transition hover:bg-[#C758FF] disabled:opacity-30"
                >
                  {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="rounded-lg px-3 py-2 text-[12px] text-[#8A7FA8] hover:text-[#E0D0F0] transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Sessions list */}
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-[#0D0A14] border border-[#2A1A4A]" />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center py-16">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#0D0A14]">
              <Music className="h-5 w-5 text-[#2A1A4A]" />
            </div>
            <p className="text-[13px] text-[#4A3F60]">No studio sessions yet</p>
            <p className="mt-1 text-[11px] text-[#2D2640]">Create your first session to start making music</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map((s) => (
              <div
                key={s.id}
                className="group flex items-center gap-4 rounded-xl border border-[#2A1A4A] bg-[#0D0A14] px-5 py-4 transition hover:border-[#3D2466] cursor-pointer"
                onClick={() => router.push(`/mmmm-studio/${s.id}`)}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#B432FF]/10">
                  <Music className="h-4 w-4 text-[#B432FF]" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="truncate text-[14px] font-semibold text-[#E0D0F0]">
                    {s.title}
                  </h3>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[#8A7FA8]">
                    <span>{s.track_count} tracks</span>
                    <span className="text-[#4A3F60]">·</span>
                    <span>{s.bpm} BPM</span>
                    <span className="text-[#4A3F60]">·</span>
                    <span>{s.key}</span>
                    {s.genre && (
                      <>
                        <span className="text-[#4A3F60]">·</span>
                        <span>{s.genre.replace("_", " ")}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.stopPropagation();
                      await deleteStudioSession(s.id);
                      await loadSessions();
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-[#2D2640] transition hover:text-red-500 opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <ArrowRight className="h-4 w-4 text-[#4A3F60] group-hover:text-[#B432FF] transition" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
