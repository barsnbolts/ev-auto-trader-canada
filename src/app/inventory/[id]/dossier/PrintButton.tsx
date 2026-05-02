"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="text-xs px-3 py-1 border border-border rounded-md hover:bg-bg-subtle"
    >
      Print / Save as PDF
    </button>
  );
}
