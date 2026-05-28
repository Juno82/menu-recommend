"use server";

import { estimateRestaurantMenus } from "@/services/restaurant-menu-estimator-service";
import type { EstimatedRestaurantMenu, Restaurant } from "@/types/menu-decider";

export async function estimateMenusAction(
  menu: string,
  restaurants: Restaurant[],
): Promise<EstimatedRestaurantMenu[]> {
  return estimateRestaurantMenus({ menu, restaurants });
}
