"use server";

import { searchNearbyRestaurants } from "@/services/kakao-local-service";
import type { Coords, Restaurant } from "@/types/menu-decider";

export async function searchRestaurantsAction(
  menu: string,
  coords: Coords,
): Promise<Restaurant[]> {
  return searchNearbyRestaurants(menu, coords);
}
