"use server";

import { decideMenu } from "@/services/menu-decider-service";
import type { MenuRecommendation, RecommendationContext } from "@/types/menu-decider";

export async function decideMenuAction(
  context: RecommendationContext,
): Promise<MenuRecommendation> {
  return decideMenu(context);
}
