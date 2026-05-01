"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "ev-tracker-favorites-v1";

// Tiny localStorage-backed favorites set. No backend, no sync — Ian's machine
// only. Shortlist of units he wants to follow up on / quote.
export function useFavorites(): {
  favorites: Set<string>;
  toggle: (id: string) => void;
  isFavorite: (id: string) => boolean;
  count: number;
} {
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setFavorites(new Set(JSON.parse(raw) as string[]));
    } catch {
      // localStorage blocked (private mode, etc.) — degrade silently
    }
  }, []);

  const persist = useCallback((next: Set<string>) => {
    try {
      localStorage.setItem(KEY, JSON.stringify([...next]));
    } catch {
      // ignore quota / privacy errors
    }
  }, []);

  const toggle = useCallback(
    (id: string) => {
      setFavorites((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const isFavorite = useCallback((id: string) => favorites.has(id), [favorites]);

  return { favorites, toggle, isFavorite, count: favorites.size };
}
