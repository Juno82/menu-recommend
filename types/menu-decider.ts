export type MenuPoolEntry = {
  name: string;
  category: string;
  tags?: string[];
};

export type TimeOfDay = "아침" | "점심" | "저녁" | "야식";

export type Weather = {
  condition: string;
  tempC: number;
};

export type Coords = {
  lat: number;
  lng: number;
};

export type RecommendationContext = {
  coords: Coords;
  regionLabel: string;
  weather: Weather;
  timeOfDay: TimeOfDay;
  prompt?: string;
  excludedMenus: string[];
};

export type MenuRecommendation = {
  menu: string;
  reason: string;
};

export type Restaurant = {
  id: string;
  name: string;
  categoryName: string;
  distanceMeters: number;
  kakaoUrl: string;
  coords: Coords;
};

export type EstimatedRestaurantMenu = {
  restaurantId: string;
  items: { name: string; priceWon: string }[];
};
