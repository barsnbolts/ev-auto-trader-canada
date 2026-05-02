import "server-only";
import { cookies } from "next/headers";
import { PROVINCES, type Province } from "./constants";
import { BuyerContextSchema, type BuyerContext } from "./types";

const DEFAULT: BuyerContext = { province: "ON", loyalty: false, conquest: false };
const NEW_COOKIE = "buyer-context";
const LEGACY_COOKIE = "buyer-province";

// Reads buyer-context cookie (JSON). Falls back to the legacy
// buyer-province cookie if present so existing visits don't reset to ON.
// Returns the validated default when nothing is set.
export async function getBuyerContext(): Promise<BuyerContext> {
  const store = await cookies();
  const v = store.get(NEW_COOKIE)?.value;
  if (v) {
    try {
      const parsed = BuyerContextSchema.parse(JSON.parse(decodeURIComponent(v)));
      return parsed;
    } catch {
      // fall through to legacy / default
    }
  }
  const legacy = store.get(LEGACY_COOKIE)?.value;
  if (legacy && (PROVINCES as readonly string[]).includes(legacy)) {
    return { ...DEFAULT, province: legacy as Province };
  }
  return DEFAULT;
}

// Convenience for callers that only need the province field. Keeps the
// existing getBuyerProvince() callsites simple while the migration rolls
// through the codebase.
export async function getBuyerProvinceFromContext(): Promise<Province> {
  return (await getBuyerContext()).province;
}
