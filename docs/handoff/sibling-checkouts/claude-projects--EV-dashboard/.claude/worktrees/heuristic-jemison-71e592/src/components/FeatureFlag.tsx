import type { ReactNode } from "react";

interface FeatureFlagProps {
  children: ReactNode;
  /** Status message shown in the overlay when the feature is paused. */
  pausedMessage: string;
  /** Set true when the feature is live; false shows the paused overlay. */
  active?: boolean;
}

/** Wraps a feature with a "paused" overlay card when `active` is false. */
export function FeatureFlag({ children, pausedMessage, active = false }: FeatureFlagProps) {
  if (active) return <>{children}</>;

  return (
    <div className="relative">
      <div className="pointer-events-none opacity-30 select-none">{children}</div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="bg-ink-800 border border-ink-600 rounded-lg px-4 py-3 text-sm text-ink-300 text-center max-w-sm shadow-lg">
          <span className="text-ink-500 text-base mr-2">⏸</span>
          {pausedMessage}
        </div>
      </div>
    </div>
  );
}
