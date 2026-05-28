import { describe, expect, it, vi } from "vitest";
import { RegionNotFoundError, resolveRegion } from "./kakao-geocoding-service";

describe("resolveRegion", () => {
  it("returns coords and label for the first matched document", async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        documents: [
          {
            place_name: "강남역",
            x: "127.0276",
            y: "37.4979",
            address_name: "서울 강남구 강남대로",
          },
        ],
      }),
    });
    const result = await resolveRegion("강남역", {
      apiKey: "fake-key",
      fetchImpl: fakeFetch as unknown as typeof fetch,
    });
    expect(result.coords.lat).toBe(37.4979);
    expect(result.coords.lng).toBe(127.0276);
    expect(result.label).toBe("강남역");
  });

  it("throws RegionNotFoundError when documents list is empty", async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ documents: [] }),
    });
    await expect(
      resolveRegion("존재하지않는동네", {
        apiKey: "fake-key",
        fetchImpl: fakeFetch as unknown as typeof fetch,
      }),
    ).rejects.toBeInstanceOf(RegionNotFoundError);
  });

  it("throws when Kakao API returns a non-ok status", async () => {
    const fakeFetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    await expect(
      resolveRegion("강남역", {
        apiKey: "fake-key",
        fetchImpl: fakeFetch as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/500/);
  });

  it("sends the KakaoAK authorization header with the configured key", async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ documents: [{ place_name: "x", x: "0", y: "0" }] }),
    });
    await resolveRegion("강남역", {
      apiKey: "REST_KEY",
      fetchImpl: fakeFetch as unknown as typeof fetch,
    });
    const [, init] = fakeFetch.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe("KakaoAK REST_KEY");
  });
});
