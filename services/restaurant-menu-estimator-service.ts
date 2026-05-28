import { GoogleGenAI } from "@google/genai";
import {
  extractText,
  type LLMClient,
  type RetryOptions,
  withGeminiRetry,
} from "@/lib/llm-client";
import type { EstimatedRestaurantMenu, Restaurant } from "@/types/menu-decider";

const MODEL = "gemini-2.5-flash-lite";
const MAX_ITEMS_PER_RESTAURANT = 3;

export type { LLMClient };

export type EstimatorInput = {
  menu: string;
  restaurants: Restaurant[];
};

export async function estimateRestaurantMenus(
  input: EstimatorInput,
  client?: LLMClient,
  retryOptions?: RetryOptions,
): Promise<EstimatedRestaurantMenu[]> {
  if (input.restaurants.length === 0) return [];

  const sdk: LLMClient =
    client ?? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const response = await withGeminiRetry(
    () =>
      sdk.models.generateContent({
        model: MODEL,
        contents: buildUserPrompt(input),
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: "application/json",
        },
      }),
    retryOptions,
  );

  const text = extractText(response);
  const parsed = parseEstimated(text);
  const validIds = new Set(input.restaurants.map((r) => r.id));

  return parsed
    .filter((entry) => validIds.has(entry.restaurantId))
    .map((entry) => ({
      restaurantId: entry.restaurantId,
      items: entry.items.slice(0, MAX_ITEMS_PER_RESTAURANT),
    }));
}

const SYSTEM_PROMPT = `당신은 한국 식당 메뉴 추정 도우미입니다. 식당의 이름과 카테고리만 보고, 그 식당이 일반적으로 팔 만한 대표 메뉴 1-3개와 추정 가격대를 한국 원화로 답합니다.

응답 형식 (JSON 배열만, 다른 텍스트 없음):
[
  { "restaurantId": "<식당 id>", "items": [ { "name": "<메뉴명>", "priceWon": "<가격, 예: '9,000원' 또는 '8,000-10,000원'>" } ] }
]

규칙:
- 사용자가 검색한 키워드 메뉴와 관련된 메뉴를 우선 포함하세요.
- 식당 카테고리에 어울리는 일반적 메뉴만 추정하세요 (없는 메뉴를 지어내지 마세요).
- priceWon은 반드시 한국어 원 단위 문자열로 작성하세요 ("9,000원", "8,000-10,000원").`;

function buildUserPrompt(input: EstimatorInput): string {
  const list = input.restaurants
    .map((r) => `- id: ${r.id} / 이름: ${r.name} / 카테고리: ${r.categoryName}`)
    .join("\n");
  return `검색 키워드 메뉴: ${input.menu}

식당 목록:
${list}

위 ${input.restaurants.length}개 식당 각각의 추정 메뉴를 응답하세요.`;
}

type ParsedEntry = {
  restaurantId: string;
  items: { name: string; priceWon: string }[];
};

function parseEstimated(text: string): ParsedEntry[] {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) {
    throw new Error("LLM response did not contain a JSON array");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(match[0]);
  } catch (cause) {
    throw new Error(`Estimator JSON parse failed: ${(cause as Error).message}`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error("Estimator response is not an array");
  }

  return parsed.filter((entry): entry is ParsedEntry => {
    if (typeof entry !== "object" || entry === null) return false;
    const e = entry as { restaurantId?: unknown; items?: unknown };
    if (typeof e.restaurantId !== "string") return false;
    if (!Array.isArray(e.items)) return false;
    return e.items.every(
      (item: unknown) =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as { name?: unknown }).name === "string" &&
        typeof (item as { priceWon?: unknown }).priceWon === "string",
    );
  });
}
