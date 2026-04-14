"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Mic, Library, Wand2, User, Music, Settings, Layers, BarChart3 } from "lucide-react";
import type { ComponentType } from "react";

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

      <div className="flex items-center justify-center pb-4">
        <span className="text-[8px] font-mono text-[#1c1b18]">0.3</span>
      </div>
    </aside>
  );
}
