export default function InventoryLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-9 w-72 bg-bg-subtle rounded" />
      <div className="card p-3 flex flex-wrap gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-7 w-32 bg-bg-subtle rounded" />
        ))}
      </div>
      <div className="card overflow-hidden">
        <div className="h-9 bg-bg-subtle/60 border-b border-border" />
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-3 py-3 border-t border-border"
            style={{ contain: "layout paint" }}
          >
            <div className="w-12 h-8 bg-bg-subtle rounded" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-48 bg-bg-subtle rounded" />
              <div className="h-2.5 w-32 bg-bg-subtle/70 rounded" />
            </div>
            <div className="h-6 w-16 bg-bg-subtle rounded" />
            <div className="h-6 w-20 bg-bg-subtle rounded" />
            <div className="h-6 w-16 bg-bg-subtle rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
