import type { Restaurant, RestaurantMenu } from "@/types/menu-decider";

/**
 * 카카오맵 place 패널의 비공식 JSON 엔드포인트.
 * 공식 REST API는 메뉴/가격을 노출하지 않으므로 panel3을 사용한다.
 * `pf: web` 헤더와 카카오 도메인 Referer가 없으면 406을 돌려준다.
 */
const PANEL_URL = "https://place-api.map.kakao.com/places/panel3";
const MAX_ITEMS_PER_RESTAURANT = 3;

export type FetchKakaoPlaceMenusOptions = {
  fetchImpl?: typeof fetch;
};

type PanelItem = {
  name?: unknown;
  price?: unknown;
  is_recommend?: unknown;
};

type PanelResponse = {
  menu?: {
    menus?: {
      items?: PanelItem[];
    };
  };
};

export async function fetchKakaoPlaceMenus(
  restaurants: Restaurant[],
  options: FetchKakaoPlaceMenusOptions = {},
): Promise<RestaurantMenu[]> {
  if (restaurants.length === 0) return [];
  const fetchImpl = options.fetchImpl ?? fetch;

  const results = await Promise.all(
    restaurants.map((r) => fetchOne(r.id, fetchImpl)),
  );
  return results.filter((entry): entry is RestaurantMenu => entry !== null);
}

async function fetchOne(
  restaurantId: string,
  fetchImpl: typeof fetch,
): Promise<RestaurantMenu | null> {
  try {
    const res = await fetchImpl(`${PANEL_URL}/${restaurantId}`, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "*/*",
        Referer: `https://place.map.kakao.com/${restaurantId}`,
        pf: "web",
      },
    });
    if (!res.ok) return null;

    const data = (await res.json()) as PanelResponse;
    const rawItems = data.menu?.menus?.items;
    if (!Array.isArray(rawItems) || rawItems.length === 0) return null;

    const valid = rawItems.filter(isValidItem);
    if (valid.length === 0) return null;

    const sorted = [...valid].sort((a, b) => {
      const aw = a.is_recommend === true ? 1 : 0;
      const bw = b.is_recommend === true ? 1 : 0;
      return bw - aw;
    });
    const top = sorted.slice(0, MAX_ITEMS_PER_RESTAURANT);

    return {
      restaurantId,
      items: top.map((item) => ({
        name: item.name,
        priceWon: formatPriceWon(item.price),
      })),
    };
  } catch {
    return null;
  }
}

type ValidItem = { name: string; price: number; is_recommend?: boolean };

function isValidItem(item: PanelItem): item is ValidItem {
  return (
    typeof item.name === "string" &&
    item.name.length > 0 &&
    typeof item.price === "number" &&
    Number.isFinite(item.price)
  );
}

export function formatPriceWon(priceWon: number): string {
  if (!Number.isFinite(priceWon) || priceWon <= 0) return "가격 미정";
  return `${priceWon.toLocaleString("ko-KR")}원`;
}
