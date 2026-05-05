// Skeleton for /inventory while server-side hydration runs. Mirrors
// InventoryTable's column shape so layout doesn't shift on data arrival —
// fav star + thumb + (year/model + trim) + msrp + asking + otd +
// daysOnLot + lastSeen + status. 24 rows covers above-fold; the live
// table renders 100+ rows progressively.
export default function InventoryLoading() {
  const cols = "32px 56px 1fr 80px 80px 80px 64px 96px 64px";
  return (
    <div className="space-y-4 animate-pulse">
      {/* Page H1 */}
      <div className="h-9 w-72 bg-bg-subtle rounded" />

      {/* FilterBar chip area */}
      <div className="card p-3 flex flex-wrap gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-7 w-32 bg-bg-subtle rounded" />
        ))}
      </div>

      {/* Inventory table */}
      <div className="card overflow-hidden">
        {/* Sticky-style header row */}
        <div
          className="grid items-center gap-3 px-3 py-2 bg-bg-subtle/60 border-b border-border"
          style={{ gridTemplateColumns: cols }}
        >
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="h-3 bg-bg-subtle rounded" />
          ))}
        </div>
        {Array.from({ length: 24 }).map((_, i) => (
          <div
            key={i}
            className="grid items-center gap-3 px-3 py-3 border-t border-border"
            style={{ gridTemplateColumns: cols, contain: "layout paint" }}
          >
            <div className="h-4 w-4 bg-bg-subtle rounded mx-auto" />
            <div className="h-8 w-12 bg-bg-subtle rounded" />
            <div className="space-y-1.5">
              <div className="h-3.5 w-48 bg-bg-subtle rounded" />
              <div className="h-2.5 w-32 bg-bg-subtle/70 rounded" />
            </div>
            <div className="h-3 w-14 bg-bg-subtle rounded" />
            <div className="h-3 w-14 bg-bg-subtle rounded" />
            <div className="h-3 w-14 bg-bg-subtle rounded" />
            <div className="h-3 w-10 bg-bg-subtle rounded" />
            <div className="h-3 w-16 bg-bg-subtle rounded" />
            <div className="h-3 w-12 bg-bg-subtle rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
