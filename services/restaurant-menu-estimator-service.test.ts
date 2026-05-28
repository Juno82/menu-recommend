import { describe, expect, it, vi } from "vitest";
import type { Restaurant } from "@/types/menu-decider";
import { estimateRestaurantMenus } from "./restaurant-menu-estimator-service";

const restaurants: Restaurant[] = [
  {
    id: "1",
    name: "김씨네 칼국수",
    categoryName: "한식 · 칼국수",
    distanceMeters: 400,
    kakaoUrl: "https://place.map.kakao.com/1",
    coords: { lat: 0, lng: 0 },
  },
  {
    id: "2",
    name: "손칼국수 명가",
    categoryName: "한식 · 칼국수",
    distanceMeters: 640,
    kakaoUrl: "https://place.map.kakao.com/2",
    coords: { lat: 0, lng: 0 },
  },
];

function mockClient(jsonText: string) {
  return {
    models: {
      generateContent: vi.fn().mockResolvedValue({ text: jsonText }),
    },
  };
}

describe("estimateRestaurantMenus", () => {
  it("maps LLM JSON response to estimated menus per restaurant", async () => {
    const responseJson = JSON.stringify([
      {
        restaurantId: "1",
        items: [
          { name: "해물칼국수", priceWon: "9,000원" },
          { name: "들깨칼국수", priceWon: "8,500원" },
        ],
      },
      {
        restaurantId: "2",
        items: [{ name: "사골칼국수", priceWon: "11,000원" }],
      },
    ]);
    const client = mockClient(responseJson);

    const result = await estimateRestaurantMenus(
      { menu: "칼국수", restaurants },
      client as never,
    );

    expect(result).toHaveLength(2);
    expect(result[0]?.restaurantId).toBe("1");
    expect(result[0]?.items[0]?.name).toBe("해물칼국수");
    expect(result[0]?.items[0]?.priceWon).toBe("9,000원");
    expect(result[1]?.items[0]?.name).toBe("사골칼국수");
  });

  it("returns empty array without calling the LLM when restaurants list is empty", async () => {
    const client = mockClient("[]");
    const result = await estimateRestaurantMenus(
      { menu: "칼국수", restaurants: [] },
      client as never,
    );
    expect(result).toEqual([]);
    expect(client.models.generateContent).not.toHaveBeenCalled();
  });

  it("includes restaurant id, name, and category in the user prompt", async () => {
    const client = mockClient("[]");
    await estimateRestaurantMenus(
      { menu: "칼국수", restaurants },
      client as never,
    );
    const call = client.models.generateContent.mock.calls[0]?.[0] as { contents: string };
    expect(call.contents).toContain("김씨네 칼국수");
    expect(call.contents).toContain("손칼국수 명가");
    expect(call.contents).toContain("한식 · 칼국수");
    expect(call.contents).toContain("id: 1");
    expect(call.contents).toContain("id: 2");
  });

  it("clamps items to at most 3 per restaurant", async () => {
    const responseJson = JSON.stringify([
      {
        restaurantId: "1",
        items: [
          { name: "메뉴1", priceWon: "9,000원" },
          { name: "메뉴2", priceWon: "8,000원" },
          { name: "메뉴3", priceWon: "10,000원" },
          { name: "메뉴4", priceWon: "11,000원" },
        ],
      },
    ]);
    const client = mockClient(responseJson);
    const result = await estimateRestaurantMenus(
      { menu: "칼국수", restaurants: [restaurants[0]!] },
      client as never,
    );
    expect(result[0]?.items).toHaveLength(3);
  });

  it("drops entries whose restaurantId is not in the input list (LLM hallucination guard)", async () => {
    const responseJson = JSON.stringify([
      { restaurantId: "1", items: [{ name: "메뉴1", priceWon: "9,000원" }] },
      { restaurantId: "999", items: [{ name: "유령식당메뉴", priceWon: "0원" }] },
    ]);
    const client = mockClient(responseJson);
    const result = await estimateRestaurantMenus(
      { menu: "칼국수", restaurants },
      client as never,
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.restaurantId).toBe("1");
  });
});
