"use server";

import { LLMRateLimitError, LLMUnavailableError } from "@/lib/llm-client";
import { decideMenu } from "@/services/menu-decider-service";
import type { MenuRecommendation, RecommendationContext } from "@/types/menu-decider";

export type DecideMenuFailureReason = "rate_limit" | "unavailable" | "unknown";

export type DecideMenuResult =
  | { ok: true; recommendation: MenuRecommendation }
  | {
      ok: false;
      reason: DecideMenuFailureReason;
      retryAfterSeconds?: number;
    };

export async function decideMenuAction(
  context: RecommendationContext,
): Promise<DecideMenuResult> {
  try {
    const recommendation = await decideMenu(context);
    return { ok: true, recommendation };
  } catch (err) {
    if (err instanceof LLMRateLimitError) {
      return {
        ok: false,
        reason: "rate_limit",
        retryAfterSeconds: err.retryAfterSeconds,
      };
    }
    if (err instanceof LLMUnavailableError) {
      return { ok: false, reason: "unavailable" };
    }
    return { ok: false, reason: "unknown" };
  }
}
