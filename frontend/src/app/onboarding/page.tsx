"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Mic, Music, Zap, ArrowRight, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { createProject, createStudioSession, addStudioTrack } from "@/lib/api";

const GENRES = [
  { value: "hip_hop", label: "Hip Hop", emoji: "🎤" },
  { value: "melodic_rap", label: "Melodic Rap", emoji: "🎶" },
  { value: "rnb", label: "R&B", emoji: "💜" },
  { value: "lofi", label: "Lo-Fi", emoji: "🌙" },
];

const MOODS = [
  { value: "dark", label: "Dark" },
  { value: "hype", label: "Hype" },
  { value: "chill", label: "Chill" },
  { value: "emotional", label: "Emotional" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [sessionName, setSessionName] = useState("");
  const [genre, setGenre] = useState("hip_hop");
  const [mood, setMood] = useState("dark");
  const [creating, setCreating] = useState(false);

  const firstName = user?.display_name?.split(" ")[0] || "there";

  const handleFinish = useCallback(async () => {
    setCreating(true);
    try {
      const project = await createProject({
        title: sessionName || "My First Session",
        user_id: user?.id || "default-user",
      });

      const session = await createStudioSession({
        title: sessionName || "My First Session",
        genre,
        project_id: project.id,
      });

      // Pre-create first track so the studio opens ready to record
      await addStudioTrack(session.id, {
        name: "Track 1",
        track_type: "recording",
        color: "#8b5cf6",
      });

      router.push(`/mmmm-studio/${session.id}`);
    } catch {
      router.push("/mmmm-studio");
    }
  }, [sessionName, genre, user, router]);

  return (
    <div className="flex min-h-screen items-center justify-center px-5">
      <div className="w-full max-w-md">
        {/* Step 0: Welcome */}
        {step === 0 && (
          <div className="text-center animate-fade-up">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FF6B35]/10">
              <Music className="h-8 w-8 text-[#FF6B35]" />
            </div>
            <h1 className="font-display text-[32px] font-light italic text-[#F0EDE8]">
              Hey {firstName}!
            </h1>
            <p className="mt-3 text-[14px] text-[#6B6560] max-w-xs mx-auto leading-relaxed">
              Let's make your first song. It takes about 60 seconds.
              Just hum, tap, or sing — we'll turn it into music.
            </p>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[#FF6B35] px-8 py-3.5 text-[14px] font-bold text-black transition hover:bg-[#FF8555] active:scale-95"
            >
              Let's go
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Step 1: Name your session */}
        {step === 1 && (
          <div className="animate-fade-up">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-[#3A3632]">
              Step 1 of 2
            </p>
            <h2 className="font-display text-[28px] font-light italic text-[#F0EDE8] mb-6">
              Name your session
            </h2>
            <input
              autoFocus
              type="text"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              placeholder="My banger, Late night vibes, Beat lab..."
              className="w-full rounded-xl border border-[#1c1b18] bg-[#0a0a09] px-5 py-4 text-[16px] text-[#F0EDE8] placeholder-[#3A3632] outline-none focus:border-[#FF6B35]/30"
              onKeyDown={(e) => e.key === "Enter" && setStep(2)}
            />
            <button
              type="button"
              onClick={() => setStep(2)}
              className="mt-5 w-full rounded-xl bg-[#FF6B35] py-3.5 text-[14px] font-bold text-black transition hover:bg-[#FF8555]"
            >
              Next
            </button>
            <button
              type="button"
              onClick={() => setStep(2)}
              className="mt-3 w-full text-center text-[12px] text-[#3A3632] hover:text-[#6B6560]"
            >
              Skip — name it later
            </button>
          </div>
        )}

        {/* Step 2: Pick your vibe */}
        {step === 2 && (
          <div className="animate-fade-up">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-[#3A3632]">
              Step 2 of 2
            </p>
            <h2 className="font-display text-[28px] font-light italic text-[#F0EDE8] mb-6">
              Pick the vibe
            </h2>

            <div className="grid grid-cols-2 gap-2 mb-5">
              {GENRES.map((g) => (
                <button
                  key={g.value}
                  type="button"
                  onClick={() => setGenre(g.value)}
                  className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-[13px] font-semibold transition active:scale-95 ${
                    genre === g.value
                      ? "border-[#FF6B35]/40 bg-[#FF6B35]/[0.06] text-[#FF6B35]"
                      : "border-[#1c1b18] bg-[#0a0a09] text-[#6B6560] hover:text-[#F0EDE8]"
                  }`}
                >
                  <span className="text-lg">{g.emoji}</span>
                  {g.label}
                </button>
              ))}
            </div>

            <div className="flex gap-1.5 mb-6">
              {MOODS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMood(m.value)}
                  className={`flex-1 rounded-lg py-2 text-[11px] font-semibold transition ${
                    mood === m.value
                      ? "bg-[#FF6B35]/10 text-[#FF6B35]"
                      : "text-[#3A3632] hover:text-[#6B6560]"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              disabled={creating}
              onClick={handleFinish}
              className="w-full rounded-xl bg-[#FF6B35] py-3.5 text-[14px] font-bold text-black transition hover:bg-[#FF8555] disabled:opacity-30 flex items-center justify-center gap-2"
            >
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Mic className="h-4 w-4" />
                  Start Making Music
                </>
              )}
            </button>
          </div>
        )}

        {/* Progress dots */}
        <div className="mt-10 flex justify-center gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? "w-6 bg-[#FF6B35]" : "w-1.5 bg-[#1c1b18]"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
