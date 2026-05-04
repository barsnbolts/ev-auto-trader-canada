import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Nav } from "@/components/Nav";
import { BuyerContextSelector } from "@/components/BuyerContextSelector";
import { ClientWarmup } from "@/components/ClientWarmup";
import { DockBadgeSync } from "@/components/DockBadgeSync";
import vehicleImages from "../../data/vehicle-images.json";

export const metadata: Metadata = {
  title: "EV Auto Trader Canada",
  description: "Kia EV6, Hyundai Ioniq 5/6 inventory, pricing, and incentives across Canada.",
};

export const viewport: Viewport = {
  themeColor: "#0a0a0b",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* Hardware-acceleration + preload hints — let the browser warm
            connections, decode images on GPU, and skip text-shift on
            font swap. Cheap and front-loaded. */}
        <link rel="dns-prefetch" href="//upload.wikimedia.org" />
        <link rel="preconnect" href="https://upload.wikimedia.org" crossOrigin="anonymous" />
        <link rel="prefetch" href="/inventory" as="document" />
        <link rel="prefetch" href="/pick-a-model" as="document" />
        <meta name="color-scheme" content="dark" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="min-h-screen flex flex-col">
        <ClientWarmup
          heroUrls={Object.values((vehicleImages as { images: Record<string, { url: string }> }).images).map((v) => v.url)}
        />
        <DockBadgeSync />
        <header className="border-b border-border bg-bg-subtle/80 backdrop-blur sticky top-0 z-10">
          <div className="max-w-[1400px] mx-auto px-6 py-3 flex items-center gap-6">
            <a href="/" className="font-semibold tracking-tight text-fg">
              EV<span className="text-accent">.</span>trader<span className="text-fg-muted text-xs ml-1">CA</span>
            </a>
            <Nav />
            <BuyerContextSelector />
          </div>
        </header>
        <main className="flex-1 max-w-[1400px] w-full mx-auto px-6 py-6">
          {children}
        </main>
        <footer className="border-t border-border text-xxs text-fg-subtle">
          <div className="max-w-[1400px] mx-auto px-6 py-3 flex flex-wrap items-center justify-between gap-2">
            <span>Data is manually researched + verified. Always confirm with the dealer before signing.</span>
            <span>Built for personal shopping use.</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
