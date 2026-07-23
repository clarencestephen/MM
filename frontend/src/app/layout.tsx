import type { Metadata } from "next";
import { Orbitron, Kosugi_Maru, Rajdhani } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import PlayerBar from "@/components/PlayerBar";
import HealthDot from "@/components/HealthDot";
import { AuthProvider } from "@/lib/auth";

const displayFont = Orbitron({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "700", "900"],
  display: "swap",
});

const bodyFont = Kosugi_Maru({
  subsets: ["latin"],
  variable: "--font-body",
  weight: "400",
  display: "swap",
});

const techFont = Rajdhani({
  subsets: ["latin"],
  variable: "--font-tech",
  weight: ["500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "MM",
  description: "AI-native music. 100% local. Zero API calls.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${displayFont.variable} ${bodyFont.variable} ${techFont.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <AuthProvider>
          <Sidebar />

          <div className="min-h-screen pl-16 flex flex-col">
            <header className="sticky top-0 z-30 flex h-11 items-center justify-between px-6 bg-[#07060B]/70 backdrop-blur-xl border-b border-[#2A1A4A]/40">
              <span className="font-display text-[14px] font-black tracking-[0.22em] text-bankai-gradient">
                MM
              </span>
              <HealthDot />
            </header>

            <main className="flex-1">{children}</main>
          </div>

          <PlayerBar />
        </AuthProvider>
      </body>
    </html>
  );
}
