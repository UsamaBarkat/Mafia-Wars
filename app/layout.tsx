import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthInit } from "@/components/AuthInit";

const SOCIAL_DESCRIPTION =
  "Play online with friends — offline pass-and-play, or create a room and play together remotely";

export const metadata: Metadata = {
  metadataBase: new URL("https://mafia-wars-olive.vercel.app"),
  title: "Mafia Wars",
  description: "Offline role setup and private role reveal for in-person Mafia.",
  // app/opengraph-image.png (Next's file-based metadata convention) is auto-detected
  // and wired into both openGraph.images and twitter's fallback image — no `images`
  // field needed here.
  openGraph: {
    title: "Mafia Wars — Social Deduction Game",
    description: SOCIAL_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "Mafia Wars — Social Deduction Game",
    description: SOCIAL_DESCRIPTION,
  },
};

// Portrait-first: this app is primarily used by passing a phone around.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthInit />
        {children}
      </body>
    </html>
  );
}
