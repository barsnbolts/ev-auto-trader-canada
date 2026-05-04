export default function PickerLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-12 bg-bg-subtle rounded" />
      <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-4">
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-9 bg-bg-subtle rounded" />
          ))}
        </div>
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-14 bg-bg-subtle rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}
