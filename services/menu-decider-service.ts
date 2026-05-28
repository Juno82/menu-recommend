import { GoogleGenAI } from "@google/genai";
import { MENU_POOL, isMenuInPool } from "@/config/menu-pool";
import { extractText, type LLMClient } from "@/lib/llm-client";
import type { MenuRecommendation, RecommendationContext } from "@/types/menu-decider";

const MODEL = "gemini-2.5-flash";

export type { LLMClient };

export class MenuPoolViolationError extends Error {
  constructor(readonly menuName: string) {
    super(`LLM returned menu "${menuName}" not in pool`);
    this.name = "MenuPoolViolationError";
  }
}

export class ExcludedMenuViolationError extends Error {
  constructor(readonly menuName: string) {
    super(`LLM returned excluded menu "${menuName}"`);
    this.name = "ExcludedMenuViolationError";
  }
}

export class LLMResponseParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LLMResponseParseError";
  }
}

export async function decideMenu(
  context: RecommendationContext,
  client?: LLMClient,
): Promise<MenuRecommendation> {
  const sdk: LLMClient =
    client ?? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const response = await sdk.models.generateContent({
    model: MODEL,
    contents: buildUserPrompt(context),
    config: {
      systemInstruction: buildSystemPrompt(),
      responseMimeType: "application/json",
    },
  });

  const text = extractText(response);
  const recommendation = parseRecommendation(text);

  if (!isMenuInPool(recommendation.menu)) {
    throw new MenuPoolViolationError(recommendation.menu);
  }
  if (context.excludedMenus.includes(recommendation.menu)) {
    throw new ExcludedMenuViolationError(recommendation.menu);
  }

  return recommendation;
}

function buildSystemPrompt(): string {
  const list = MENU_POOL.map(
    (entry) =>
      `- ${entry.name} (${entry.category})${entry.tags ? ` [${entry.tags.join(", ")}]` : ""}`,
  ).join("\n");

  return `당신은 메뉴 결정 도우미입니다. 사용자의 위치, 날씨, 시간대, 자유 입력 조건을 종합해 아래 메뉴 목록에서 가장 적절한 메뉴 1개를 골라 추천합니다.

[메뉴 목록]
${list}

응답 형식 (JSON 객체, 다른 텍스트 없음):
{
  "menu": "<목록에서 고른 메뉴명 그대로>",
  "reason": "<한 줄 추천 이유 — 날씨 또는 시간대 단서를 자연어로 포함>",
  "searchQuery": "<카카오맵에서 그 메뉴를 파는 식당을 찾기 위한 한국어 키워드>"
}

규칙:
- menu는 반드시 위 목록의 메뉴명과 정확히 동일해야 합니다 (목록에 없는 메뉴는 절대 만들지 마세요).
- 사용자가 제외 요청한 메뉴는 절대 선택하지 마세요.
- reason은 한 문장, 50자 이내, 따뜻한 어투로 작성하고 날씨나 시간대 단서를 한 단어라도 자연스럽게 포함하세요.
- searchQuery는 한국 사람이 카카오맵에서 그런 종류 식당을 찾을 때 흔히 입력하는 키워드를 고르세요.
  - 식당 간판/이름에 메뉴명이 자주 들어가면 menu 그대로 사용 (예: "칼국수" → "칼국수", "삼겹살" → "삼겹살").
  - 간판에 잘 안 들어가는 메뉴는 카테고리 단어 (예: "잔치국수" → "국수", "라면" → "분식", "간짜장" → "중식", "평양냉면" → "냉면", "오므라이스" → "경양식", "사케동" → "회덮밥", "토마토파스타" → "파스타", "들깨칼국수" → "칼국수", "산채비빔밥" → "비빔밥", "황태해장국" → "해장국", "굴짬뽕" → "짬뽕", "마라샹궈" → "마라", "후라이드" → "치킨").
  - 가장 일반적인 1-2 단어로 짧게.`;
}

function buildUserPrompt(context: RecommendationContext): string {
  const parts: string[] = [
    `위치: ${context.regionLabel}`,
    `날씨: ${context.weather.condition} ${context.weather.tempC}°C`,
    `시간대: ${context.timeOfDay}`,
  ];
  if (context.prompt && context.prompt.trim().length > 0) {
    parts.push(`조건: ${context.prompt.trim()}`);
  }
  if (context.excludedMenus.length > 0) {
    parts.push(`이미 추천한 메뉴 (제외): ${context.excludedMenus.join(", ")}`);
  }
  return parts.join("\n");
}

function parseRecommendation(text: string): MenuRecommendation {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new LLMResponseParseError("LLM response did not contain a JSON object");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(match[0]);
  } catch (cause) {
    throw new LLMResponseParseError(
      `LLM response JSON parse failed: ${(cause as Error).message}`,
    );
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as { menu?: unknown }).menu !== "string" ||
    typeof (parsed as { reason?: unknown }).reason !== "string"
  ) {
    throw new LLMResponseParseError("LLM response missing menu or reason");
  }
  const obj = parsed as { menu: string; reason: string; searchQuery?: unknown };
  // searchQuery 누락/공백 시 menu로 fallback — UI는 영향 없고 검색은 메뉴명으로 시도
  const searchQuery =
    typeof obj.searchQuery === "string" && obj.searchQuery.trim().length > 0
      ? obj.searchQuery.trim()
      : obj.menu;
  return {
    menu: obj.menu,
    reason: obj.reason,
    searchQuery,
  };
}
