import type { Metadata } from "next";
import "./globals.css";
import "@/remotion/fonts";

export const metadata: Metadata = {
  title: "Cadence - AI captions & video editing",
  description: "Local-first video editor: automatic transcription, 30 animated caption styles, timeline editing and MP4 export.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="ui-motion min-h-full">{children}</body>
    </html>
  );
}
