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
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#FF6B35]">
            <span className="text-lg font-black text-black">M</span>
          </div>
          <h1 className="font-display text-[28px] font-light italic text-[#F0EDE8]">
            Create your account
          </h1>
          <p className="mt-1 text-[13px] text-[#6B6560]">
            Start making music in seconds
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="w-full rounded-xl border border-[#1c1b18] bg-[#0a0a09] px-4 py-3 text-[14px] text-[#F0EDE8] placeholder-[#3A3632] outline-none focus:border-[#FF6B35]/30"
          />
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full rounded-xl border border-[#1c1b18] bg-[#0a0a09] px-4 py-3 text-[14px] text-[#F0EDE8] placeholder-[#3A3632] outline-none focus:border-[#FF6B35]/30"
          />
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (6+ characters)"
            className="w-full rounded-xl border border-[#1c1b18] bg-[#0a0a09] px-4 py-3 text-[14px] text-[#F0EDE8] placeholder-[#3A3632] outline-none focus:border-[#FF6B35]/30"
          />

          {error && (
            <div className="rounded-lg bg-red-900/10 border border-red-900/20 px-4 py-2.5 text-[12px] text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !email || !password}
            className="w-full rounded-xl bg-[#FF6B35] py-3 text-[14px] font-bold text-black transition hover:bg-[#FF8555] disabled:opacity-30"
          >
            {submitting ? (
              <Loader2 className="mx-auto h-5 w-5 animate-spin" />
            ) : (
              "Sign Up Free"
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-[12px] text-[#3A3632]">
          Already have an account?{" "}
          <Link href="/login" className="text-[#FF6B35] hover:underline">
            Log in
          </Link>
        </p>

        <p className="mt-4 text-center text-[10px] text-[#231F1C]">
          Free plan includes 2 tracks, preset instruments, and MP3 export.{" "}
          <Link href="/pricing" className="text-[#3A3632] hover:text-[#6B6560]">
            See Pro features
          </Link>
        </p>
      </div>
    </div>
  );
}
