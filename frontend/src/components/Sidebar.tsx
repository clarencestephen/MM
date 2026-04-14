"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Mic, Wand2, User, Settings, Layers, BarChart3, LogOut, Crown } from "lucide-react";
import type { ComponentType } from "react";
import { useAuth } from "@/lib/auth";

interface NavItem {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { label: "Create", href: "/", icon: Mic },
  { label: "MMMM Studio", href: "/mmmm-studio", icon: Layers },
  { label: "Transform", href: "/transform", icon: Wand2 },
  { label: "Personas", href: "/personas", icon: User },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Settings", href: "/settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  // Don't show sidebar on auth pages
  if (["/signup", "/login", "/pricing"].includes(pathname)) {
    return null;
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-16 flex-col bg-black border-r border-[#0f0e0c]">
      {/* Logo */}
      <div className="flex h-11 items-center justify-center">
        <Link href="/" className="flex h-7 w-7 items-center justify-center rounded-md bg-[#FF6B35] transition hover:bg-[#FF8555]">
          <span className="text-[11px] font-black text-black">M</span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col items-center gap-0.5 pt-6">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={`group relative flex h-10 w-10 items-center justify-center rounded-lg transition-all ${
                isActive
                  ? "text-[#FF6B35]"
                  : "text-[#2a2923] hover:text-[#6B6560]"
              }`}
            >
              <Icon className="h-[18px] w-[18px]" />
              {isActive && (
                <span className="absolute -left-[8px] top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-r-full bg-[#FF6B35]" />
              )}
              <span className="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-md bg-[#111110] px-2.5 py-1 text-[10px] font-semibold text-[#6B6560] opacity-0 shadow-xl transition-opacity group-hover:opacity-100">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* User + Upgrade + Logout */}
      <div className="flex flex-col items-center gap-1.5 pb-4">
        {/* Upgrade to Pro */}
        <Link
          href="/pricing"
          title="Upgrade to Pro"
          className="group relative flex h-10 w-10 items-center justify-center rounded-lg text-[#FF6B35] transition hover:bg-[#FF6B35]/10"
        >
          <Crown className="h-[18px] w-[18px]" />
          <span className="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-md bg-[#111110] px-2.5 py-1 text-[10px] font-semibold text-[#FF6B35] opacity-0 shadow-xl transition-opacity group-hover:opacity-100">
            Upgrade to Pro
          </span>
        </Link>

        {/* User avatar */}
        {user && (
          <div className="group relative flex h-10 w-10 items-center justify-center">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#111110] border border-[#1c1b18] text-[10px] font-bold text-[#6B6560]">
              {(user.display_name || user.email)[0].toUpperCase()}
            </div>
            <span className="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-md bg-[#111110] px-2.5 py-1 text-[10px] font-semibold text-[#6B6560] opacity-0 shadow-xl transition-opacity group-hover:opacity-100">
              {user.display_name || user.email}
            </span>
          </div>
        )}

        {/* Logout */}
        <button
          type="button"
          onClick={logout}
          title="Log out"
          className="group relative flex h-10 w-10 items-center justify-center rounded-lg text-[#1c1b18] transition hover:text-[#6B6560]"
        >
          <LogOut className="h-[16px] w-[16px]" />
          <span className="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-md bg-[#111110] px-2.5 py-1 text-[10px] font-semibold text-[#6B6560] opacity-0 shadow-xl transition-opacity group-hover:opacity-100">
            Log out
          </span>
        </button>

        <span className="text-[8px] font-mono text-[#1c1b18]">0.4</span>
      </div>
    </aside>
  );
}
