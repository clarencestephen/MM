"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";

export default function SignupPage() {
  const { signup } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setSubmitting(true);
    setError(null);
    try {
      await signup(email, password, name || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-5">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#B432FF]">
            <span className="text-lg font-black text-white">M</span>
          </div>
          <h1 className="font-display text-[28px] font-light italic text-[#E0D0F0]">
            Create your account
          </h1>
          <p className="mt-1 text-[13px] text-[#8A7FA8]">
            Start making music in seconds
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="w-full rounded-xl border border-[#2A1A4A] bg-[#0D0A14] px-4 py-3 text-[14px] text-[#E0D0F0] placeholder-[#4A3F60] outline-none focus:border-[#B432FF]/30"
          />
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full rounded-xl border border-[#2A1A4A] bg-[#0D0A14] px-4 py-3 text-[14px] text-[#E0D0F0] placeholder-[#4A3F60] outline-none focus:border-[#B432FF]/30"
          />
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (6+ characters)"
            className="w-full rounded-xl border border-[#2A1A4A] bg-[#0D0A14] px-4 py-3 text-[14px] text-[#E0D0F0] placeholder-[#4A3F60] outline-none focus:border-[#B432FF]/30"
          />

          {error && (
            <div className="rounded-lg bg-red-900/10 border border-red-900/20 px-4 py-2.5 text-[12px] text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !email || !password}
            className="w-full rounded-xl bg-[#B432FF] py-3 text-[14px] font-bold text-white transition hover:bg-[#C758FF] disabled:opacity-30"
          >
            {submitting ? (
              <Loader2 className="mx-auto h-5 w-5 animate-spin" />
            ) : (
              "Sign Up Free"
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-[12px] text-[#4A3F60]">
          Already have an account?{" "}
          <Link href="/login" className="text-[#B432FF] hover:underline">
            Log in
          </Link>
        </p>

        <p className="mt-4 text-center text-[10px] text-[#2D2640]">
          Free plan includes 2 tracks, preset instruments, and MP3 export.{" "}
          <Link href="/pricing" className="text-[#4A3F60] hover:text-[#8A7FA8]">
            See Pro features
          </Link>
        </p>
      </div>
    </div>
  );
}
