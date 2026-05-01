import "server-only";
import { cookies } from "next/headers";
import { PROVINCES, type Province } from "./constants";

const DEFAULT: Province = "ON";

// Reads the buyer-province cookie set by the client selector. Defaults to
// ON (Ian's home province) when unset or unrecognized.
export async function getBuyerProvince(): Promise<Province> {
  const store = await cookies();
  const v = store.get("buyer-province")?.value;
  if (v && (PROVINCES as readonly string[]).includes(v)) {
    return v as Province;
  }
  return DEFAULT;
}
