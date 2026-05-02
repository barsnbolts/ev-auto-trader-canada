const SOURCES = [
  {
    name: "Geotab",
    role: "Winter range & charging data from real-world fleet telematics",
    url: "https://www.geotab.com/fleet-management-solutions/electric-vehicles/",
  },
  {
    name: "Recurrent Auto",
    role: "Battery health and degradation data from 15,000+ EVs",
    url: "https://www.recurrentauto.com/research",
  },
  {
    name: "Fastned",
    role: "DC charging curve measurements",
    url: "https://support.fastned.nl/hc/en-gb/articles/360054731914",
  },
  {
    name: "P3 Group",
    role: "Independent EV charging benchmarks",
    url: "https://www.p3-group.com/p3-e-performance-check/",
  },
  {
    name: "Bjørn Nyland",
    role: "Range and charging test videos",
    url: "https://www.youtube.com/@bjornnyland",
  },
];

export function CreditsPanel() {
  return (
    <div className="mt-8 pt-6 border-t border-ink-800">
      <div className="text-[11px] uppercase tracking-widest text-ink-500 mb-3">
        Data sources
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        {SOURCES.map((s) => (
          <a
            key={s.url}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col text-xs"
            title={s.role}
          >
            <span className="text-ink-300 group-hover:text-accent-blue transition-colors">
              {s.name}
            </span>
            <span className="text-ink-600 text-[10px]">{s.role}</span>
          </a>
        ))}
      </div>
      <div className="mt-3 text-[10px] text-ink-700">
        All values are hand-researched and tagged with confidence (H / M / L).
        Numbers without two independent sources are marked Medium or Low.
      </div>
    </div>
  );
}
