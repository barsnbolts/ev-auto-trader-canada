import "./globals.css";
import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { BuyerProvinceSelector } from "@/components/BuyerProvinceSelector";

export const metadata: Metadata = {
  title: "EV Auto Trader Canada",
  description: "Kia EV6, Hyundai Ioniq 5/6 inventory, pricing, and incentives across Canada (GTA-focused).",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen flex flex-col">
        <header className="border-b border-border bg-bg-subtle/80 backdrop-blur sticky top-0 z-10">
          <div className="max-w-[1400px] mx-auto px-6 py-3 flex items-center gap-6">
            <a href="/" className="font-semibold tracking-tight text-fg">
              EV<span className="text-accent">.</span>trader<span className="text-fg-muted text-xs ml-1">CA</span>
            </a>
            <Nav />
            <BuyerProvinceSelector />
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
