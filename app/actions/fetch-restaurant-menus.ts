"use server";

import { fetchKakaoPlaceMenus } from "@/services/kakao-place-menu-service";
import type { Restaurant, RestaurantMenu } from "@/types/menu-decider";

export async function fetchRestaurantMenusAction(
  restaurants: Restaurant[],
): Promise<RestaurantMenu[]> {
  return fetchKakaoPlaceMenus(restaurants);
}
