"use client";
/**
 * TempContext — pure client-side tempC + precon state.
 *
 * Why: previously TempSlider drag triggered router.replace → full SSR →
 * chips re-render via prop change. Even with debounce, this felt chunky
 * because Next refetches the whole page.
 *
 * Now: provider holds state, slider writes to provider, chips read from
 * provider — purely client-side. URL stays in sync via
 * window.history.replaceState (bookmark-friendly, no router refetch).
 *
 * Initial values come from the server-rendered URL on first paint, so
 * SSR / share-link still works.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

interface TempState {
  tempC: number;
  preconditioned: boolean;
}

interface TempCtx extends TempState {
  setTempC: (v: number) => void;
  setPrecon: (v: boolean) => void;
  reset: () => void;
}

const DEFAULT_TEMP = 20;
const Ctx = createContext<TempCtx | null>(null);

export function TempProvider({
  initialTempC = DEFAULT_TEMP,
  initialPreconditioned = false,
  children,
}: {
  initialTempC?: number;
  initialPreconditioned?: boolean;
  children: React.ReactNode;
}) {
  const [tempC, setTempCState] = useState(initialTempC);
  const [preconditioned, setPreconState] = useState(initialPreconditioned);
  const writeUrlRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced URL sync via history.replaceState — no router refetch.
  const syncUrl = useCallback((nextTemp: number, nextPrecon: boolean) => {
    if (writeUrlRef.current) clearTimeout(writeUrlRef.current);
    writeUrlRef.current = setTimeout(() => {
      if (typeof window === "undefined") return;
      const url = new URL(window.location.href);
      if (nextTemp === DEFAULT_TEMP) url.searchParams.delete("tempC");
      else url.searchParams.set("tempC", String(nextTemp));
      if (nextPrecon) url.searchParams.set("precon", "1");
      else url.searchParams.delete("precon");
      window.history.replaceState(null, "", url.toString());
    }, 250);
  }, []);

  const setTempC = useCallback(
    (v: number) => {
      const clamped = Math.max(-40, Math.min(40, Math.round(v)));
      setTempCState(clamped);
      syncUrl(clamped, preconditioned);
    },
    [preconditioned, syncUrl],
  );

  const setPrecon = useCallback(
    (v: boolean) => {
      setPreconState(v);
      syncUrl(tempC, v);
    },
    [tempC, syncUrl],
  );

  const reset = useCallback(() => {
    setTempCState(DEFAULT_TEMP);
    setPreconState(false);
    syncUrl(DEFAULT_TEMP, false);
  }, [syncUrl]);

  // Cleanup any pending debounced write when unmounting.
  useEffect(() => () => {
    if (writeUrlRef.current) clearTimeout(writeUrlRef.current);
  }, []);

  const value = useMemo<TempCtx>(
    () => ({ tempC, preconditioned, setTempC, setPrecon, reset }),
    [tempC, preconditioned, setTempC, setPrecon, reset],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTemp(): TempCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTemp must be used inside <TempProvider>");
  return ctx;
}

/** Soft variant — returns null when no provider exists. Lets components
 *  fall back to props when rendered outside the inventory context. */
export function useTempOptional(): TempCtx | null {
  return useContext(Ctx);
}
