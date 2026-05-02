import { useState } from "react";
import { FilterBar } from "./components/FilterBar";
import { BrandList } from "./components/BrandList";
import { CompareTray } from "./components/CompareTray";
import { CompareView } from "./components/CompareView";
import { DataHealth } from "./components/DataHealth";
import { useAppStore } from "./store/useAppStore";
import { DebugPanel } from "./components/DebugPanel";

function App() {
  const [compareOpen, setCompareOpen] = useState(false);
  const { mom_mode, setMomMode } = useAppStore();

  return (
    <div className="min-h-screen flex flex-col bg-ink-900 text-ink-100 font-body">
      <header className="px-6 py-4 border-b border-ink-700 bg-ink-800/40 flex items-center gap-4 flex-wrap">
        <h1 className="font-display text-xl tracking-tight">EV Dashboard</h1>
        <span className="text-xs text-ink-400">
          Canadian EV / PHEV / EREV comparison
        </span>
        <DataHealth />
        <label
          className="flex items-center gap-2 text-xs text-ink-300 cursor-pointer bg-ink-700/40 rounded px-2 py-1"
          title="Plain-English mode: swaps technical jargon for approachable labels. Great for showing non-technical family members."
        >
          <input
            type="checkbox"
            checked={mom_mode}
            onChange={(e) => setMomMode(e.target.checked)}
            className="accent-accent-blue"
          />
          Plain English
        </label>
        <span className="ml-auto text-xs text-ink-500 whitespace-normal">
          Long-range trims only · Generation-aware · All numbers cited
        </span>
      </header>

      <FilterBar />

      <main className="flex-1">
        <BrandList />
      </main>

      <footer className="px-6 py-3 border-t border-ink-700 bg-ink-800/40 text-xs text-ink-500 flex items-center gap-4">
        <span>Schema v0.1 · Seed data · Verify all numbers before purchase decisions.</span>
        <span className="ml-auto">
          Federal iZEV: paused/uncertain 2026 · Ontario provincial rebate: none
        </span>
      </footer>

      <CompareTray onOpen={() => setCompareOpen(true)} />
      {compareOpen && <CompareView onClose={() => setCompareOpen(false)} />}
      <DebugPanel />
    </div>
  );
}

export default App;
