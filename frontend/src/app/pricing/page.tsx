"use client";

import Link from "next/link";
import { Check, X, Sparkles } from "lucide-react";

const FEATURES = [
  { name: "Tracks per session", free: "2", pro: "Unlimited" },
  { name: "Record + upload audio", free: true, pro: true },
  { name: "Instrument presets (15)", free: true, pro: true },
  { name: "Custom instrument prompts", free: false, pro: true },
  { name: "Key & tempo sync", free: false, pro: true },
  { name: "Sample library", free: "20 sounds", pro: "Full library" },
  { name: "MP3 export", free: true, pro: true },
  { name: "WAV export", free: false, pro: true },
  { name: "Stems export", free: false, pro: true },
  { name: "Ableton (.als) export", free: false, pro: true },
  { name: "MIDI input support", free: false, pro: true },
  { name: "Song arrangement", free: false, pro: true },
];

function FeatureCheck({ value }: { value: boolean | string }) {
  if (typeof value === "string") {
    return <span className="text-[12px] text-[#E0D0F0]">{value}</span>;
  }
  return value ? (
    <Check className="h-4 w-4 text-emerald-500" />
  ) : (
    <X className="h-4 w-4 text-[#2D2640]" />
  );
}

export default function PricingPage() {
  return (
    <div className="min-h-screen pb-32">
      <div className="mx-auto max-w-3xl px-5 pt-16 sm:px-6">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="font-display text-[42px] font-light italic text-[#E0D0F0]">
            Simple pricing
          </h1>
          <p className="mt-2 text-[14px] text-[#8A7FA8]">
            Start free. Go Pro when you need more power.
          </p>
        </div>

        {/* Plans */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-12">
          {/* Free */}
          <div className="rounded-2xl border border-[#2A1A4A] bg-[#0D0A14] p-6">
            <h3 className="text-[18px] font-bold text-[#E0D0F0]">Free</h3>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-[36px] font-bold text-[#E0D0F0]">$0</span>
              <span className="text-[13px] text-[#4A3F60]">/forever</span>
            </div>
            <p className="mt-2 text-[12px] text-[#8A7FA8]">
              Get started making music. No credit card needed.
            </p>
            <Link
              href="/signup"
              className="mt-6 block rounded-xl border border-[#2A1A4A] bg-[#1A0A2E] py-3 text-center text-[13px] font-semibold text-[#E0D0F0] transition hover:border-[#3D2466]"
            >
              Sign Up Free
            </Link>
          </div>

          {/* Pro */}
          <div className="rounded-2xl border-2 border-[#B432FF]/40 bg-[#B432FF]/[0.03] p-6 relative">
            <div className="absolute -top-3 left-6 flex items-center gap-1 rounded-full bg-[#B432FF] px-3 py-1 text-[10px] font-bold text-white">
              <Sparkles className="h-3 w-3" />
              MOST POPULAR
            </div>
            <h3 className="text-[18px] font-bold text-[#E0D0F0]">Pro</h3>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-[36px] font-bold text-[#E0D0F0]">$10</span>
              <span className="text-[13px] text-[#8A7FA8]">/month</span>
            </div>
            <p className="mt-2 text-[12px] text-[#8A7FA8]">
              Unlimited tracks, custom instruments, pro exports.
            </p>
            <Link
              href="/signup"
              className="mt-6 block rounded-xl bg-[#B432FF] py-3 text-center text-[13px] font-bold text-white transition hover:bg-[#C758FF]"
            >
              Start Pro
            </Link>
          </div>
        </div>

        {/* Feature comparison */}
        <div className="rounded-2xl border border-[#2A1A4A] bg-[#0D0A14] overflow-hidden">
          <div className="grid grid-cols-3 gap-4 border-b border-[#2A1A4A] px-6 py-4">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#4A3F60]">
              Feature
            </span>
            <span className="text-center text-[11px] font-bold uppercase tracking-widest text-[#4A3F60]">
              Free
            </span>
            <span className="text-center text-[11px] font-bold uppercase tracking-widest text-[#B432FF]">
              Pro
            </span>
          </div>
          {FEATURES.map((f) => (
            <div
              key={f.name}
              className="grid grid-cols-3 gap-4 border-b border-[#1A0A2E] px-6 py-3 last:border-0"
            >
              <span className="text-[13px] text-[#8A7FA8]">{f.name}</span>
              <div className="flex justify-center">
                <FeatureCheck value={f.free} />
              </div>
              <div className="flex justify-center">
                <FeatureCheck value={f.pro} />
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="mt-8 text-center">
          <p className="text-[12px] text-[#4A3F60]">
            Everything runs on your machine. Zero API calls. Your music, your data.
          </p>
        </div>
      </div>
    </div>
  );
}
