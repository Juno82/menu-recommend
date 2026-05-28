import { describe, expect, it, vi } from "vitest";
import { formatWalkingDistance, searchNearbyRestaurants } from "./kakao-local-service";

describe("searchNearbyRestaurants", () => {
  it("returns up to 3 mapped restaurants from a Kakao response", async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        documents: [
          {
            id: "1",
            place_name: "김씨네 칼국수",
            category_name: "음식점 > 한식 > 칼국수",
            distance: "350",
            x: "127.0276",
            y: "37.4979",
            place_url: "https://place.map.kakao.com/1",
          },
          {
            id: "2",
            place_name: "손칼국수 명가",
            category_name: "음식점 > 한식 > 칼국수",
            distance: "640",
            x: "127.029",
            y: "37.497",
            place_url: "https://place.map.kakao.com/2",
          },
        ],
      }),
    });

    const result = await searchNearbyRestaurants(
      "칼국수",
      { lat: 37.5, lng: 127 },
      { apiKey: "fake-key", fetchImpl: fakeFetch as unknown as typeof fetch },
    );

    expect(result).toHaveLength(2);
    expect(result[0]?.name).toBe("김씨네 칼국수");
    expect(result[0]?.distanceMeters).toBe(350);
    expect(result[0]?.coords.lat).toBe(37.4979);
    expect(result[0]?.kakaoUrl).toBe("https://place.map.kakao.com/1");
  });

  it("returns an empty array when Kakao returns no documents", async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ documents: [] }),
    });

    const result = await searchNearbyRestaurants(
      "냉면",
      { lat: 37.5, lng: 127 },
      { apiKey: "fake-key", fetchImpl: fakeFetch as unknown as typeof fetch },
    );

    expect(result).toEqual([]);
  });

  it("throws when Kakao API returns a non-ok status", async () => {
    const fakeFetch = vi.fn().mockResolvedValue({ ok: false, status: 401 });
    await expect(
      searchNearbyRestaurants(
        "칼국수",
        { lat: 0, lng: 0 },
        { apiKey: "fake-key", fetchImpl: fakeFetch as unknown as typeof fetch },
      ),
    ).rejects.toThrow(/401/);
  });

  it("sends KakaoAK authorization header and correct query parameters", async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ documents: [] }),
    });
    await searchNearbyRestaurants(
      "칼국수",
      { lat: 37.5, lng: 127.0276 },
      { apiKey: "REST_KEY", fetchImpl: fakeFetch as unknown as typeof fetch },
    );
    const [url, init] = fakeFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(`query=${encodeURIComponent("칼국수")}`);
    expect(url).toContain("x=127.0276");
    expect(url).toContain("y=37.5");
    expect((init.headers as Record<string, string>).Authorization).toBe("KakaoAK REST_KEY");
  });
});

describe("formatWalkingDistance", () => {
  it("converts meters to walking minutes at ~80m/min", () => {
    expect(formatWalkingDistance(400)).toBe("도보 5분");
    expect(formatWalkingDistance(800)).toBe("도보 10분");
    expect(formatWalkingDistance(640)).toBe("도보 8분");
  });

  it("clamps to a minimum of 1 minute", () => {
    expect(formatWalkingDistance(10)).toBe("도보 1분");
    expect(formatWalkingDistance(0)).toBe("도보 1분");
  });
});
