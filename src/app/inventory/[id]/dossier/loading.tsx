export default function DossierLoading() {
  return (
    <div className="dossier max-w-3xl mx-auto px-6 py-8 animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="h-3 w-24 bg-bg-subtle rounded" />
        <div className="h-7 w-20 bg-bg-subtle rounded" />
      </div>
      <div className="space-y-3">
        <div className="h-8 w-3/4 bg-bg-subtle rounded" />
        <div className="h-4 w-1/2 bg-bg-subtle/70 rounded" />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <section key={i} className="mt-6 space-y-2">
          <div className="h-4 w-40 bg-bg-subtle rounded" />
          <div className="h-32 bg-bg-subtle/60 rounded" />
        </section>
      ))}
    </div>
  );
}
