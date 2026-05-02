import { useAppStore } from "../store/useAppStore";
import { vehicleById, brandById } from "../data";

export function CompareTray({
  onOpen,
}: {
  onOpen: () => void;
}) {
  const { compareIds, toggleCompare, clearCompare } = useAppStore();

  if (compareIds.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-ink-800/95 border-t border-ink-700 backdrop-blur-md z-30 shadow-2xl">
      <div className="px-6 py-3 flex items-center gap-3">
        <div className="flex-1 flex flex-wrap gap-2">
          {compareIds.map((id) => {
            const v = vehicleById(id);
            const b = v ? brandById(v.brand_id) : undefined;
            if (!v) return null;
            return (
              <button
                key={id}
                onClick={() => toggleCompare(id)}
                className="group flex items-center gap-2 bg-ink-700 rounded-md px-3 py-1.5 hover:bg-ink-600 transition"
                title="Remove from compare"
              >
                <span className="text-xs text-ink-100">
                  <span className="text-ink-400">{b?.name}</span>{" "}
                  {v.model}{" "}
                  <span className="text-ink-400">{v.trim_label}</span>
                </span>
                <span className="text-ink-500 group-hover:text-accent-red">×</span>
              </button>
            );
          })}
        </div>
        <div className="text-xs text-ink-400">
          {compareIds.length} / 4
        </div>
        <button
          onClick={clearCompare}
          className="text-xs text-ink-400 hover:text-ink-100 underline"
        >
          Clear
        </button>
        <button
          onClick={onOpen}
          className="bg-accent-blue text-white font-medium text-sm px-4 py-1.5 rounded hover:bg-accent-blue/90 transition"
          disabled={compareIds.length < 2}
          title={compareIds.length < 2 ? "Pick at least 2 vehicles to compare" : undefined}
        >
          Compare →
        </button>
      </div>
    </div>
  );
}
