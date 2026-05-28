import type { Coords } from "@/types/menu-decider";

const KAKAO_KEYWORD_SEARCH = "https://dapi.kakao.com/v2/local/search/keyword.json";

export class RegionNotFoundError extends Error {
  constructor(readonly regionName: string) {
    super(`Region not found: ${regionName}`);
    this.name = "RegionNotFoundError";
  }
}

export type GeocodingOptions = {
  apiKey?: string;
  fetchImpl?: typeof fetch;
};

export type ResolvedRegion = {
  coords: Coords;
  label: string;
};

type KakaoDoc = {
  place_name?: string;
  address_name?: string;
  x: string;
  y: string;
};

export async function resolveRegion(
  regionName: string,
  options: GeocodingOptions = {},
): Promise<ResolvedRegion> {
  const apiKey = options.apiKey ?? process.env.KAKAO_REST_API_KEY;
  if (!apiKey) {
    throw new Error("KAKAO_REST_API_KEY is not configured");
  }
  const fetchImpl = options.fetchImpl ?? fetch;

  const url = `${KAKAO_KEYWORD_SEARCH}?query=${encodeURIComponent(regionName)}&size=1`;
  const res = await fetchImpl(url, {
    headers: { Authorization: `KakaoAK ${apiKey}` },
  });
  if (!res.ok) {
    throw new Error(`Kakao geocoding request failed: ${res.status}`);
  }

  const data = (await res.json()) as { documents?: KakaoDoc[] };
  const documents = data.documents ?? [];
  if (documents.length === 0) {
    throw new RegionNotFoundError(regionName);
  }
  const doc = documents[0]!;
  return {
    coords: {
      lat: Number.parseFloat(doc.y),
      lng: Number.parseFloat(doc.x),
    },
    label: doc.place_name ?? doc.address_name ?? regionName,
  };
}
