import type { Coords, Weather } from "@/types/menu-decider";

const OPEN_METEO_BASE = "https://api.open-meteo.com/v1/forecast";

export async function fetchWeather(
  coords: Coords,
  fetchImpl: typeof fetch = fetch,
): Promise<Weather> {
  const url = `${OPEN_METEO_BASE}?latitude=${coords.lat}&longitude=${coords.lng}&current=temperature_2m,weather_code`;
  const res = await fetchImpl(url);
  if (!res.ok) {
    throw new Error(`Open-Meteo request failed: ${res.status}`);
  }
  const data = (await res.json()) as {
    current?: { temperature_2m?: number; weather_code?: number };
  };
  const tempRaw = data.current?.temperature_2m;
  const codeRaw = data.current?.weather_code;
  if (typeof tempRaw !== "number" || typeof codeRaw !== "number") {
    throw new Error("Open-Meteo response missing current fields");
  }
  return {
    condition: weatherCodeToCondition(codeRaw),
    tempC: Math.round(tempRaw),
  };
}

export function weatherCodeToCondition(code: number): string {
  if (code === 0) return "맑음";
  if (code >= 1 && code <= 3) return "흐림";
  if (code === 45 || code === 48) return "안개";
  if (code >= 51 && code <= 57) return "이슬비";
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return "비";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "눈";
  if (code >= 95 && code <= 99) return "천둥번개";
  return "흐림";
}
