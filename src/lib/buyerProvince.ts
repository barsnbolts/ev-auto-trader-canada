"use client";

import { useCallback, useEffect, useState } from "react";
import type { Province } from "./constants";
import { PROVINCES } from "./constants";

const COOKIE = "buyer-province";
const DEFAULT: Province = "ON";

// Persist via cookie so server components (home page Top Deals, etc.) see
// the same buyer-province context as client components without a hydration
// mismatch. localStorage would work for client-only but home reads the
// cookie at request time and re-renders SSR.
function readCookie(): Province {
  if (typeof document === "undefined") return DEFAULT;
  const m = document.cookie.match(/(?:^|;\s*)buyer-province=([A-Z]{2})/);
  if (!m) return DEFAULT;
  const candidate = m[1] as Province;
  return (PROVINCES as readonly string[]).includes(candidate) ? candidate : DEFAULT;
}

function writeCookie(value: Province) {
  if (typeof document === "undefined") return;
  // 1 year, path=/ so all routes share it
  document.cookie = `${COOKIE}=${value}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
}

export function useBuyerProvince(): {
  buyerProvince: Province;
  setBuyerProvince: (p: Province) => void;
} {
  const [buyerProvince, setProvinceState] = useState<Province>(DEFAULT);

  useEffect(() => {
    setProvinceState(readCookie());
  }, []);

  const setBuyerProvince = useCallback((p: Province) => {
    writeCookie(p);
    setProvinceState(p);
    // Trigger a soft router refresh so server components pick up the new
    // cookie. Done via location.reload to avoid pulling next/navigation in
    // here; cheap on a personal-use SPA.
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  }, []);

  return { buyerProvince, setBuyerProvince };
}
