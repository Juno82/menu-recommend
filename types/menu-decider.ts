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
  /**
   * 카카오 식당 검색에 사용할 키워드. 메뉴명이 식당 간판에 잘 들어가지 않는
   * 경우(예: "잔치국수" → "국수", "라면" → "분식")를 위해 LLM이 함께 결정한다.
   * UI 표시(메뉴 카드 등)에는 menu를 그대로 사용하고, 검색에만 이 값을 쓴다.
   * 누락 시 호출자가 menu로 fallback한다.
   */
  searchQuery?: string;
};

export type Restaurant = {
  id: string;
  name: string;
  categoryName: string;
  distanceMeters: number;
  kakaoUrl: string;
  coords: Coords;
};

export type RestaurantMenu = {
  restaurantId: string;
  items: { name: string; priceWon: string }[];
};
