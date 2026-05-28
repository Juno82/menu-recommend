import Anthropic from "@anthropic-ai/sdk";
import { MENU_POOL, isMenuInPool } from "@/config/menu-pool";
import { extractText, type LLMClient } from "@/lib/llm-client";
import type { MenuRecommendation, RecommendationContext } from "@/types/menu-decider";

const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 256;

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
  const sdk: LLMClient = client ?? new Anthropic();

  const response = await sdk.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: [
      {
        type: "text",
        text: buildSystemPrompt(),
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: buildUserPrompt(context) }],
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

응답 형식 (JSON만, 다른 텍스트 없음):
{ "menu": "<목록에서 고른 메뉴명 그대로>", "reason": "<한 줄 추천 이유 — 날씨 또는 시간대 단서를 자연어로 포함>" }

규칙:
- menu는 반드시 위 목록의 메뉴명과 정확히 동일해야 합니다 (목록에 없는 메뉴는 절대 만들지 마세요).
- 사용자가 제외 요청한 메뉴는 절대 선택하지 마세요.
- reason은 한 문장, 50자 이내, 따뜻한 어투로 작성하고 날씨나 시간대 단서를 한 단어라도 자연스럽게 포함하세요.`;
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
  return {
    menu: (parsed as { menu: string }).menu,
    reason: (parsed as { reason: string }).reason,
  };
}
