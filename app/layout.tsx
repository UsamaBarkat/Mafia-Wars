import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthInit } from "@/components/AuthInit";

export const metadata: Metadata = {
  title: "Mafia Wars",
  description: "Offline role setup and private role reveal for in-person Mafia.",
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
