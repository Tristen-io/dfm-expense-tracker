import type { Metadata, Viewport } from "next";
import "./globals.css";

// Uses the system font stack (see globals.css) instead of next/font/google —
// avoids a build-time dependency on fetching fonts from Google's CDN, which
// keeps builds fast and reliable on Vercel's free tier with zero setup.

export const metadata: Metadata = {
  title: "DFM Concrete & Asphalt — Expense Tracker",
  description: "Log and review employee expenses, materials, and fuel costs.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-50">{children}</body>
    </html>
  );
}
