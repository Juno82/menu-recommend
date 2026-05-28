import { describe, expect, it, vi } from "vitest";
import { fetchWeather, weatherCodeToCondition } from "./weather";

describe("weatherCodeToCondition", () => {
  it("maps WMO codes to Korean labels", () => {
    expect(weatherCodeToCondition(0)).toBe("맑음");
    expect(weatherCodeToCondition(2)).toBe("흐림");
    expect(weatherCodeToCondition(45)).toBe("안개");
    expect(weatherCodeToCondition(51)).toBe("이슬비");
    expect(weatherCodeToCondition(61)).toBe("비");
    expect(weatherCodeToCondition(71)).toBe("눈");
    expect(weatherCodeToCondition(95)).toBe("천둥번개");
  });

  it("falls back to 흐림 for unknown codes", () => {
    expect(weatherCodeToCondition(999)).toBe("흐림");
  });
});

describe("fetchWeather", () => {
  it("fetches Open-Meteo with provided coords and maps the response", async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ current: { temperature_2m: 18.7, weather_code: 3 } }),
    });
    const result = await fetchWeather(
      { lat: 37.5, lng: 127 },
      fakeFetch as unknown as typeof fetch,
    );
    expect(result.condition).toBe("흐림");
    expect(result.tempC).toBe(19); // rounded
    const calledUrl = fakeFetch.mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain("latitude=37.5");
    expect(calledUrl).toContain("longitude=127");
    expect(calledUrl).toContain("weather_code");
  });

  it("throws when Open-Meteo returns non-ok status", async () => {
    const fakeFetch = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    await expect(
      fetchWeather({ lat: 0, lng: 0 }, fakeFetch as unknown as typeof fetch),
    ).rejects.toThrow(/503/);
  });
});
