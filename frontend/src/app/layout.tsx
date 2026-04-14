import type { Metadata } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import PlayerBar from "@/components/PlayerBar";
import HealthDot from "@/components/HealthDot";
import { AuthProvider } from "@/lib/auth";

const displayFont = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const bodyFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MM — Music Maker",
  description: "AI-native Hip Hop music creation. 100% local.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${displayFont.variable} ${bodyFont.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <AuthProvider>
          {/* Sidebar */}
          <Sidebar />

          {/* Main area */}
          <div className="min-h-screen pl-16 flex flex-col">
            {/* Header — barely there */}
            <header className="sticky top-0 z-30 flex h-11 items-center justify-between px-6 bg-black/70 backdrop-blur-xl">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-bold tracking-tight text-[#F0EDE8]">
                  MM
                </span>
                <span className="text-[9px] font-semibold uppercase tracking-[0.25em] text-[#3A3632]">
                  Music Maker
                </span>
              </div>
              <HealthDot />
            </header>

            {/* Page */}
            <main className="flex-1">{children}</main>
          </div>

          {/* Persistent player */}
          <PlayerBar />
        </AuthProvider>
      </body>
    </html>
  );
}
