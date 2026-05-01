import { relativeDays } from "@/lib/format";

type Row = { label: string; iso: string | null };

export function UpdatedStamp({ rows }: { rows: Row[] }) {
  return (
    <div className="text-xxs text-fg-subtle text-right space-y-0.5">
      {rows.map((r) => (
        <div key={r.label}>
          {r.label} {r.iso ? relativeDays(r.iso) : "never"}
        </div>
      ))}
    </div>
  );
}
