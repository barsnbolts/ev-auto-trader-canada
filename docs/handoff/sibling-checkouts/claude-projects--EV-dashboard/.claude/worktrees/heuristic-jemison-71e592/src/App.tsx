import { useState } from "react";
import { FilterBar } from "./components/FilterBar";
import { BrandList } from "./components/BrandList";
import { CompareTray } from "./components/CompareTray";
import { CompareView } from "./components/CompareView";
import { DebugPanel } from "./components/DebugPanel";
import { useAppStore } from "./store/useAppStore";
import { debugLog } from "./lib/debugLog";

function App() {
  const [compareOpen, setCompareOpen] = useState(false);
  const { plainMode, setPlainMode } = useAppStore();

  return (
    <div className="min-h-screen flex flex-col bg-ink-900 text-ink-100 font-body">
      <header className="px-6 py-4 border-b border-ink-700 bg-ink-800/40 flex items-center gap-x-4 gap-y-2 flex-wrap">
        <h1 className="font-display text-xl tracking-tight shrink-0">EV Dashboard</h1>
        <span className="text-xs text-ink-400 min-w-0 truncate">
          Canadian EV / PHEV / EREV comparison
        </span>
        <span className="ml-auto flex items-center gap-x-3 gap-y-2 flex-wrap justify-end">
          {/* Plain / Geek toggle */}
          <button
            onClick={() => setPlainMode(!plainMode)}
            aria-pressed={plainMode}
            aria-label={plainMode ? "Switch to technical labels" : "Switch to plain language"}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              plainMode
                ? "bg-accent-blue/20 border-accent-blue text-accent-blue"
                : "bg-ink-700 border-ink-600 text-ink-400 hover:border-ink-500 hover:text-ink-300"
            }`}
          >
            <span className="text-[10px]">{plainMode ? "Plain" : "Geek"}</span>
            <span className="opacity-60" aria-hidden="true">·</span>
            <span className="text-[10px] opacity-60">{plainMode ? "Geek" : "Plain"}</span>
          </button>
          <span className="text-xs text-ink-500 hidden sm:inline">
            Long-range trims only · All numbers cited
          </span>
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

      <CompareTray
        onOpen={() => {
          debugLog("ui", "compare_view_open");
          setCompareOpen(true);
        }}
      />
      {compareOpen && (
        <CompareView
          onClose={() => {
            debugLog("ui", "compare_view_close");
            setCompareOpen(false);
          }}
        />
      )}
      <DebugPanel />
    </div>
  );
}

export default App;
