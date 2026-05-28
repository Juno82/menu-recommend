import type { GenerateContentConfig, GoogleGenAI } from "@google/genai";

export type GenerateContentParams = {
  model: string;
  contents: string;
  config?: GenerateContentConfig;
};

export type GenerateContentResult = {
  text?: string;
};

export type LLMClient = {
  models: {
    generateContent: (params: GenerateContentParams) => Promise<GenerateContentResult>;
  };
};

/**
 * @google/genai의 `GoogleGenAI` 인스턴스는 우리 `LLMClient` 인터페이스를 만족한다.
 * Mock에서는 같은 모양의 객체로 대체한다.
 */
export type AnyLLMClient = LLMClient | GoogleGenAI;

export function extractText(response: GenerateContentResult): string {
  return typeof response.text === "string" ? response.text : "";
}

export class LLMRateLimitError extends Error {
  constructor(readonly retryAfterSeconds?: number) {
    super(
      retryAfterSeconds !== undefined
        ? `Gemini rate limit; retry in ${retryAfterSeconds}s`
        : "Gemini rate limit",
    );
    this.name = "LLMRateLimitError";
  }
}

export class LLMUnavailableError extends Error {
  constructor(cause?: unknown) {
    super("Gemini service unavailable");
    this.name = "LLMUnavailableError";
    if (cause !== undefined) {
      (this as { cause?: unknown }).cause = cause;
    }
  }
}

type WithApiErrorShape = { status?: number; message?: string };

function isApiError(e: unknown): e is WithApiErrorShape {
  return typeof e === "object" && e !== null && "status" in e;
}

function parseRetryDelaySeconds(message: string | undefined): number | undefined {
  if (!message) return undefined;
  const m = message.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
  if (!m) return undefined;
  const value = Number.parseFloat(m[1]);
  return Number.isFinite(value) ? value : undefined;
}

export type RetryOptions = {
  /** 503 재시도 횟수. 기본 2 (1s, 2s backoff — 총 ~3s, Vercel hobby 10s 예산 내). */
  max503Retries?: number;
  /** 테스트용 sleep 주입. */
  sleep?: (ms: number) => Promise<void>;
};

/**
 * Gemini 호출을 retry로 감싼다.
 * - 429 → 즉시 `LLMRateLimitError`. retryDelay는 보통 20-60s이므로 함수 타임아웃 안에서 기다리는 게 무의미.
 * - 503 → exponential backoff (1s, 2s)로 최대 max503Retries회 재시도. 끝까지 실패 시 `LLMUnavailableError`.
 * - 그 외 에러는 그대로 throw.
 */
export async function withGeminiRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const max503 = options.max503Retries ?? 2;
  const sleep = options.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (e) {
      if (isApiError(e)) {
        if (e.status === 429) {
          throw new LLMRateLimitError(parseRetryDelaySeconds(e.message));
        }
        if (e.status === 503) {
          if (attempt >= max503) {
            throw new LLMUnavailableError(e);
          }
          await sleep(1000 * 2 ** attempt);
          attempt += 1;
          continue;
        }
      }
      throw e;
    }
  }
}
