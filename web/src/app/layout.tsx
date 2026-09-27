import type { Metadata, Viewport } from "next";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import "./globals.css";

export const metadata: Metadata = {
  title: "YatraAI — Discover Bharatpur",
  description: "Discover Bharatpur with an interactive tourism map and an AI route discovery assistant.",
  applicationName: "YatraAI",
  appleWebApp: {
    capable: true,
    title: "YatraAI",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#f6f7f2",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><ServiceWorkerRegistration />{children}</body>
    </html>
  );
}
