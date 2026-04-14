"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Plus,
  X,
  Mic2,
  Upload,
  User2,
  Music2,
  ExternalLink,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import {
  listPersonas,
  createPersona,
  uploadVoiceSample,
} from "@/lib/api";
import type { Persona } from "@/lib/types";

// ---------------------------------------------------------------------------
// Style options
// ---------------------------------------------------------------------------

const STYLE_OPTIONS = [
  { value: "rap", label: "Rap", description: "Hard bars, fast flow" },
  { value: "melodic", label: "Melodic", description: "Singing, auto-tune vibes" },
  { value: "rnb", label: "R&B", description: "Smooth, soulful vocals" },
] as const;

type StyleValue = (typeof STYLE_OPTIONS)[number]["value"];

// ---------------------------------------------------------------------------
// Style badge
// ---------------------------------------------------------------------------

function StyleBadge({ style }: { style: string | null }) {
  if (!style) return null;
  const colors: Record<string, string> = {
    rap: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    melodic: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    rnb: "bg-pink-500/15 text-pink-400 border-pink-500/30",
  };
  return (
    <span
      className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
        colors[style] || "bg-zinc-800 text-zinc-400 border-zinc-700"
      }`}
    >
      {style.toUpperCase()}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Persona Card
// ---------------------------------------------------------------------------

function PersonaCard({
  persona,
  onVoiceUploaded,
}: {
  persona: Persona;
  onVoiceUploaded: (updated: Persona) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleVoiceUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setUploading(true);
      setUploadSuccess(false);
      try {
        await uploadVoiceSample(persona.id, file);
        setUploadSuccess(true);
        // Refetch persona data would be ideal, but we update locally
        onVoiceUploaded({
          ...persona,
          voice_sample_url: URL.createObjectURL(file),
        });
      } catch (err) {
        console.error("Voice upload failed:", err);
      } finally {
        setUploading(false);
      }
    },
    [persona, onVoiceUploaded]
  );

  const hasVoice = !!persona.voice_sample_url;

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-zinc-800 bg-zinc-900 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-600/20">
            <User2 className="h-5 w-5 text-violet-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">
              {persona.name}
            </h3>
            {persona.description && (
              <p className="mt-0.5 text-xs text-zinc-500 line-clamp-2">
                {persona.description}
              </p>
            )}
          </div>
        </div>
        <StyleBadge style={persona.style_mode} />
      </div>

      {/* Voice sample status */}
      <div className="flex items-center gap-2 rounded-md bg-zinc-800/50 px-3 py-2">
        <Mic2
          className={`h-4 w-4 ${
            hasVoice ? "text-green-400" : "text-zinc-600"
          }`}
        />
        <span className="flex-1 text-xs text-zinc-400">
          {hasVoice ? "Voice sample uploaded" : "No voice sample"}
        </span>
        {uploadSuccess && (
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-700 disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          {uploading ? "Uploading..." : "Upload Voice"}
        </button>
        <a
          href="/transform"
          className="flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-violet-500"
        >
          <Music2 className="h-3.5 w-3.5" />
          Use in Studio
        </a>
        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          onChange={handleVoiceUpload}
          className="hidden"
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create Persona Modal
// ---------------------------------------------------------------------------

function CreatePersonaModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (persona: Persona) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [style, setStyle] = useState<StyleValue>("rap");
  const [creating, setCreating] = useState(false);
  const [step, setStep] = useState<"form" | "voice">("form");
  const [newPersona, setNewPersona] = useState<Persona | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleCreate() {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const persona = await createPersona({
        name: name.trim(),
        description: description.trim() || undefined,
        style_mode: style,
        user_id: "default",
      });
      setNewPersona(persona);
      setStep("voice");
    } catch (err) {
      console.error("Create persona failed:", err);
    } finally {
      setCreating(false);
    }
  }

  async function handleVoiceUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !newPersona) return;
    setUploading(true);
    try {
      await uploadVoiceSample(newPersona.id, file);
      onCreated({
        ...newPersona,
        voice_sample_url: URL.createObjectURL(file),
      });
      handleClose();
    } catch (err) {
      console.error("Voice upload failed:", err);
    } finally {
      setUploading(false);
    }
  }

  function handleSkipVoice() {
    if (newPersona) {
      onCreated(newPersona);
    }
    handleClose();
  }

  function handleClose() {
    setName("");
    setDescription("");
    setStyle("rap");
    setStep("form");
    setNewPersona(null);
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-100">
            {step === "form" ? "Create Persona" : "Upload Voice Sample"}
          </h2>
          <button
            onClick={handleClose}
            className="rounded-lg p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {step === "form" ? (
          <div className="flex flex-col gap-4">
            {/* Name */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                Name
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. MC Blaze, Smooth Sarah"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:border-violet-500 focus:outline-none"
              />
            </div>

            {/* Description */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Describe the persona's vibe, tone, attitude..."
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:border-violet-500 focus:outline-none"
              />
            </div>

            {/* Style mode */}
            <div>
              <label className="mb-2 block text-xs font-medium text-zinc-400">
                Style
              </label>
              <div className="grid grid-cols-3 gap-2">
                {STYLE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setStyle(opt.value)}
                    className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-center transition-colors ${
                      style === opt.value
                        ? "border-violet-500 bg-violet-500/10 text-violet-300"
                        : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600"
                    }`}
                  >
                    <span className="text-sm font-medium">{opt.label}</span>
                    <span className="text-[10px] text-zinc-500">
                      {opt.description}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Submit */}
            <button
              onClick={handleCreate}
              disabled={creating || !name.trim()}
              className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
            >
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {creating ? "Creating..." : "Create Persona"}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-zinc-700 bg-zinc-800/50 p-8">
              <Mic2 className="h-10 w-10 text-zinc-500" />
              <p className="text-center text-sm text-zinc-400">
                Upload a voice sample to clone this persona&apos;s voice
              </p>
              <p className="text-center text-xs text-zinc-600">
                WAV or MP3, ideally 10-30 seconds of clean vocals
              </p>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="mt-2 flex items-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {uploading ? "Uploading..." : "Choose File"}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="audio/*"
                onChange={handleVoiceUpload}
                className="hidden"
              />
            </div>
            <button
              onClick={handleSkipVoice}
              className="text-sm text-zinc-500 transition-colors hover:text-zinc-300"
            >
              Skip for now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function PersonasPage() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    listPersonas()
      .then(setPersonas)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleCreated = useCallback((persona: Persona) => {
    setPersonas((prev) => [persona, ...prev]);
  }, []);

  const handleVoiceUploaded = useCallback((updated: Persona) => {
    setPersonas((prev) =>
      prev.map((p) => (p.id === updated.id ? updated : p))
    );
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-100">Personas</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Create and manage voice personas for your tracks.
            </p>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-500"
          >
            <Plus className="h-4 w-4" />
            Create Persona
          </button>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-zinc-600" />
          </div>
        ) : personas.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-zinc-800 py-20">
            <User2 className="h-12 w-12 text-zinc-700" />
            <div className="text-center">
              <p className="text-sm font-medium text-zinc-400">
                No personas yet
              </p>
              <p className="mt-1 text-xs text-zinc-600">
                Create your first persona to get started.
              </p>
            </div>
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500"
            >
              <Plus className="h-4 w-4" />
              Create Persona
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {personas.map((persona) => (
              <PersonaCard
                key={persona.id}
                persona={persona}
                onVoiceUploaded={handleVoiceUploaded}
              />
            ))}
          </div>
        )}

        {/* Modal */}
        <CreatePersonaModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onCreated={handleCreated}
        />
      </div>
    </div>
  );
}
