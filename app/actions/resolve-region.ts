"use server";

import {
  RegionNotFoundError,
  resolveRegion,
  type ResolvedRegion,
} from "@/services/kakao-geocoding-service";

export type RegionResolveResult =
  | { ok: true; region: ResolvedRegion }
  | { ok: false; reason: "not_found" | "error"; message: string };

export async function resolveRegionAction(regionName: string): Promise<RegionResolveResult> {
  try {
    const region = await resolveRegion(regionName);
    return { ok: true, region };
  } catch (err) {
    if (err instanceof RegionNotFoundError) {
      return { ok: false, reason: "not_found", message: err.message };
    }
    return {
      ok: false,
      reason: "error",
      message: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
