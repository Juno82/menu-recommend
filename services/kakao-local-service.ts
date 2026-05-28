import type { Coords, Restaurant } from "@/types/menu-decider";

const KAKAO_KEYWORD_SEARCH = "https://dapi.kakao.com/v2/local/search/keyword.json";
const DEFAULT_RADIUS_METERS = 1000;
const WALKING_METERS_PER_MIN = 80;

export type KakaoSearchOptions = {
  apiKey?: string;
  radius?: number;
  fetchImpl?: typeof fetch;
};

type KakaoDocument = {
  id: string;
  place_name: string;
  category_name: string;
  distance: string;
  x: string;
  y: string;
  place_url: string;
};

export async function searchNearbyRestaurants(
  query: string,
  coords: Coords,
  options: KakaoSearchOptions = {},
): Promise<Restaurant[]> {
  const apiKey = options.apiKey ?? process.env.KAKAO_REST_API_KEY;
  if (!apiKey) {
    throw new Error("KAKAO_REST_API_KEY is not configured");
  }
  const radius = options.radius ?? DEFAULT_RADIUS_METERS;
  const fetchImpl = options.fetchImpl ?? fetch;

  const url =
    `${KAKAO_KEYWORD_SEARCH}` +
    `?query=${encodeURIComponent(query)}` +
    `&x=${coords.lng}` +
    `&y=${coords.lat}` +
    `&radius=${radius}` +
    `&size=3`;

  const res = await fetchImpl(url, {
    headers: { Authorization: `KakaoAK ${apiKey}` },
  });

  if (!res.ok) {
    throw new Error(`Kakao Local API request failed: ${res.status}`);
  }

  const data = (await res.json()) as { documents?: KakaoDocument[] };
  const documents = data.documents ?? [];

  return documents.slice(0, 3).map(mapDocument);
}

function mapDocument(doc: KakaoDocument): Restaurant {
  return {
    id: doc.id,
    name: doc.place_name,
    categoryName: simplifyCategory(doc.category_name),
    distanceMeters: Number.parseInt(doc.distance ?? "0", 10) || 0,
    kakaoUrl: doc.place_url,
    coords: {
      lat: Number.parseFloat(doc.y),
      lng: Number.parseFloat(doc.x),
    },
  };
}

function simplifyCategory(category: string): string {
  const parts = category.split(" > ").filter((p) => p && p !== "음식점");
  return parts.slice(-2).join(" · ");
}

export function formatWalkingDistance(meters: number): string {
  const minutes = Math.max(1, Math.round(meters / WALKING_METERS_PER_MIN));
  return `도보 ${minutes}분`;
}
