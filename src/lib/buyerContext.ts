"use client";

import { useCallback, useEffect, useState } from "react";
import { PROVINCES, type Province } from "./constants";
import { BuyerContextSchema, type BuyerContext } from "./types";

const DEFAULT: BuyerContext = { province: "ON", loyalty: false, conquest: false };
const NEW_COOKIE = "buyer-context";
const LEGACY_COOKIE = "buyer-province";
const ONE_YEAR = 60 * 60 * 24 * 365;

function readCookie(): BuyerContext {
  if (typeof document === "undefined") return DEFAULT;
  const m = document.cookie.match(/(?:^|;\s*)buyer-context=([^;]+)/);
  if (m) {
    try {
      return BuyerContextSchema.parse(JSON.parse(decodeURIComponent(m[1])));
    } catch {
      // fall through
    }
  }
  // Legacy single-province cookie (set before loyalty/conquest landed).
  const lm = document.cookie.match(/(?:^|;\s*)buyer-province=([A-Z]{2})/);
  if (lm && (PROVINCES as readonly string[]).includes(lm[1])) {
    return { ...DEFAULT, province: lm[1] as Province };
  }
  return DEFAULT;
}

function writeCookie(value: BuyerContext) {
  if (typeof document === "undefined") return;
  const v = encodeURIComponent(JSON.stringify(value));
  document.cookie = `${NEW_COOKIE}=${v}; path=/; max-age=${ONE_YEAR}; SameSite=Lax`;
  // Also keep the legacy cookie current so any code still reading the
  // single-string cookie stays consistent. Safe to drop after every caller
  // moves to buyer-context.
  document.cookie = `${LEGACY_COOKIE}=${value.province}; path=/; max-age=${ONE_YEAR}; SameSite=Lax`;
}

export function useBuyerContext(): {
  buyerContext: BuyerContext;
  setBuyerContext: (next: BuyerContext) => void;
} {
  const [buyerContext, setState] = useState<BuyerContext>(DEFAULT);

  useEffect(() => {
    setState(readCookie());
  }, []);

  const setBuyerContext = useCallback((next: BuyerContext) => {
    writeCookie(next);
    setState(next);
    // Reload so server components recompute OTD + applicable incentives
    // against the new context. Cheap on a personal-use SPA.
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  }, []);

  return { buyerContext, setBuyerContext };
}
