import { describe, expect, it, vi } from "vitest";
import type { Restaurant } from "@/types/menu-decider";
import { fetchKakaoPlaceMenus, formatPriceWon } from "./kakao-place-menu-service";

const restaurants: Restaurant[] = [
  {
    id: "27344652",
    name: "육갑식당 서래마을 직영점",
    categoryName: "한식 · 육류,고기",
    distanceMeters: 263,
    kakaoUrl: "https://place.map.kakao.com/27344652",
    coords: { lat: 0, lng: 0 },
  },
  {
    id: "181268539",
    name: "해남천일관",
    categoryName: "한식",
    distanceMeters: 228,
    kakaoUrl: "https://place.map.kakao.com/181268539",
    coords: { lat: 0, lng: 0 },
  },
];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("fetchKakaoPlaceMenus", () => {
  it("returns empty array when given no restaurants without calling fetch", async () => {
    const fetchImpl = vi.fn();
    const result = await fetchKakaoPlaceMenus([], { fetchImpl });
    expect(result).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("requests panel3 with the required headers (pf:web, Referer, UA)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ menu: { menus: { items: [] } } }));
    await fetchKakaoPlaceMenus([restaurants[0]!], { fetchImpl });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://place-api.map.kakao.com/places/panel3/27344652");
    const headers = init.headers as Record<string, string>;
    expect(headers["pf"]).toBe("web");
    expect(headers["Referer"]).toBe("https://place.map.kakao.com/27344652");
    expect(headers["User-Agent"]).toMatch(/Mozilla/);
  });

  it("maps menu.menus.items[] to RestaurantMenu with formatted priceWon", async () => {
    const body = {
      menu: {
        menus: {
          items: [
            { name: "육갑 (150g)", price: 23000, is_recommend: false },
            { name: "육갑꽃살 (150g)", price: 32000, is_recommend: false },
            { name: "육갑한돈생삼겹살 (170g)", price: 17000, is_recommend: false },
          ],
        },
      },
    };
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(body));
    const result = await fetchKakaoPlaceMenus([restaurants[0]!], { fetchImpl });

    expect(result).toHaveLength(1);
    expect(result[0]?.restaurantId).toBe("27344652");
    expect(result[0]?.items).toEqual([
      { name: "육갑 (150g)", priceWon: "23,000원" },
      { name: "육갑꽃살 (150g)", priceWon: "32,000원" },
      { name: "육갑한돈생삼겹살 (170g)", priceWon: "17,000원" },
    ]);
  });

  it("prefers is_recommend=true items and caps at 3", async () => {
    const body = {
      menu: {
        menus: {
          items: [
            { name: "메뉴1", price: 1000, is_recommend: false },
            { name: "메뉴2", price: 2000, is_recommend: false },
            { name: "추천메뉴A", price: 3000, is_recommend: true },
            { name: "메뉴3", price: 4000, is_recommend: false },
            { name: "추천메뉴B", price: 5000, is_recommend: true },
          ],
        },
      },
    };
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(body));
    const result = await fetchKakaoPlaceMenus([restaurants[0]!], { fetchImpl });
    const names = result[0]?.items.map((i) => i.name);
    expect(names).toEqual(["추천메뉴A", "추천메뉴B", "메뉴1"]);
  });

  it("skips restaurants whose response has no menu items (instead of throwing)", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          menu: {
            menus: {
              items: [{ name: "심", price: 60000, is_recommend: false }],
            },
          },
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ menu: { menus: { items: [] } } }));

    const result = await fetchKakaoPlaceMenus(restaurants, { fetchImpl });
    expect(result).toHaveLength(1);
    expect(result[0]?.restaurantId).toBe("27344652");
  });

  it("skips restaurants whose fetch fails (network error or non-200) without failing the batch", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          menu: {
            menus: {
              items: [{ name: "심", price: 60000, is_recommend: false }],
            },
          },
        }),
      )
      .mockRejectedValueOnce(new Error("network down"));

    const result = await fetchKakaoPlaceMenus(restaurants, { fetchImpl });
    expect(result).toHaveLength(1);
    expect(result[0]?.restaurantId).toBe("27344652");
  });

  it("treats non-numeric or zero prices as '가격 미정'", async () => {
    const body = {
      menu: {
        menus: {
          items: [
            { name: "시가메뉴", price: 0, is_recommend: false },
            { name: "정상메뉴", price: 12500, is_recommend: false },
          ],
        },
      },
    };
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(body));
    const result = await fetchKakaoPlaceMenus([restaurants[0]!], { fetchImpl });
    expect(result[0]?.items[0]).toEqual({ name: "시가메뉴", priceWon: "가격 미정" });
    expect(result[0]?.items[1]).toEqual({ name: "정상메뉴", priceWon: "12,500원" });
  });
});

describe("formatPriceWon", () => {
  it("formats positive integers with Korean grouping and 원 suffix", () => {
    expect(formatPriceWon(9000)).toBe("9,000원");
    expect(formatPriceWon(23000)).toBe("23,000원");
    expect(formatPriceWon(1234567)).toBe("1,234,567원");
  });

  it("returns '가격 미정' for non-positive values", () => {
    expect(formatPriceWon(0)).toBe("가격 미정");
    expect(formatPriceWon(-100)).toBe("가격 미정");
  });
});
