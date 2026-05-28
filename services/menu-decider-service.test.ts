import { describe, expect, it, vi } from "vitest";
import { LLMRateLimitError, LLMUnavailableError } from "@/lib/llm-client";
import type { RecommendationContext } from "@/types/menu-decider";
import {
  ExcludedMenuViolationError,
  MenuPoolViolationError,
  decideMenu,
} from "./menu-decider-service";

const baseContext: RecommendationContext = {
  coords: { lat: 37.5, lng: 127 },
  regionLabel: "서울 강남구",
  weather: { condition: "흐림", tempC: 18 },
  timeOfDay: "점심",
  excludedMenus: [],
};

type MockResponse = { menu: string; reason?: string };

function mockClient(response: MockResponse | string) {
  const text =
    typeof response === "string"
      ? response
      : JSON.stringify({ menu: response.menu, reason: response.reason ?? "테스트 이유" });
  return {
    models: {
      generateContent: vi.fn().mockResolvedValue({ text }),
    },
  };
}

describe("decideMenu", () => {
  it("returns menu and reason when LLM picks from pool", async () => {
    const client = mockClient({ menu: "칼국수", reason: "비 오는 점심엔 따끈한 칼국수" });
    const result = await decideMenu(baseContext, client as never);
    expect(result.menu).toBe("칼국수");
    expect(result.reason).toBe("비 오는 점심엔 따끈한 칼국수");
  });

  it("throws MenuPoolViolationError when LLM returns menu outside the pool", async () => {
    const client = mockClient({ menu: "AI가지어낸가짜메뉴" });
    await expect(decideMenu(baseContext, client as never)).rejects.toBeInstanceOf(
      MenuPoolViolationError,
    );
  });

  it("throws ExcludedMenuViolationError when LLM returns an excluded menu", async () => {
    const client = mockClient({ menu: "칼국수" });
    const context: RecommendationContext = { ...baseContext, excludedMenus: ["칼국수"] };
    await expect(decideMenu(context, client as never)).rejects.toBeInstanceOf(
      ExcludedMenuViolationError,
    );
  });

  it("includes weather, temperature and time-of-day in the user prompt", async () => {
    const client = mockClient({ menu: "된장찌개" });
    await decideMenu(baseContext, client as never);
    const call = client.models.generateContent.mock.calls[0]?.[0] as { contents: string };
    expect(call.contents).toContain("흐림");
    expect(call.contents).toContain("18");
    expect(call.contents).toContain("점심");
  });

  it("includes the user prompt in the message when provided", async () => {
    const client = mockClient({ menu: "샐러드" });
    await decideMenu(
      { ...baseContext, prompt: "느끼한 거 빼고" },
      client as never,
    );
    const call = client.models.generateContent.mock.calls[0]?.[0] as { contents: string };
    expect(call.contents).toContain("느끼한 거 빼고");
  });

  it("includes excluded menus and an exclusion hint in the user prompt", async () => {
    const client = mockClient({ menu: "된장찌개" });
    await decideMenu(
      { ...baseContext, excludedMenus: ["칼국수", "라면"] },
      client as never,
    );
    const call = client.models.generateContent.mock.calls[0]?.[0] as { contents: string };
    expect(call.contents).toContain("칼국수");
    expect(call.contents).toContain("라면");
    expect(call.contents).toContain("제외");
  });

  it("requests JSON response mime type with the menu pool as system instruction", async () => {
    const client = mockClient({ menu: "칼국수" });
    await decideMenu(baseContext, client as never);
    const call = client.models.generateContent.mock.calls[0]?.[0] as {
      config?: { systemInstruction?: string; responseMimeType?: string };
    };
    expect(call.config?.responseMimeType).toBe("application/json");
    expect(call.config?.systemInstruction).toContain("메뉴 목록");
  });

  it("throws LLMRateLimitError with retryAfterSeconds parsed from a 429 response", async () => {
    const apiError = Object.assign(new Error('{"error":{"code":429,"details":[{"@type":"type.googleapis.com/google.rpc.RetryInfo","retryDelay":"39s"}]}}'), {
      status: 429,
      message:
        '{"error":{"code":429,"details":[{"@type":"type.googleapis.com/google.rpc.RetryInfo","retryDelay":"39s"}]}}',
    });
    const client = {
      models: { generateContent: vi.fn().mockRejectedValue(apiError) },
    };
    let caught: unknown;
    try {
      await decideMenu(baseContext, client as never, { sleep: async () => {} });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(LLMRateLimitError);
    expect((caught as LLMRateLimitError).retryAfterSeconds).toBe(39);
    expect(client.models.generateContent).toHaveBeenCalledTimes(1);
  });

  it("retries 503 errors and succeeds on the second attempt", async () => {
    const apiError = Object.assign(new Error("503 unavailable"), {
      status: 503,
      message: "503 unavailable",
    });
    const client = {
      models: {
        generateContent: vi
          .fn()
          .mockRejectedValueOnce(apiError)
          .mockResolvedValueOnce({
            text: JSON.stringify({ menu: "칼국수", reason: "이유" }),
          }),
      },
    };
    const result = await decideMenu(baseContext, client as never, {
      sleep: async () => {},
    });
    expect(result.menu).toBe("칼국수");
    expect(client.models.generateContent).toHaveBeenCalledTimes(2);
  });

  it("throws LLMUnavailableError after exhausting 503 retries", async () => {
    const apiError = Object.assign(new Error("503 unavailable"), {
      status: 503,
      message: "503 unavailable",
    });
    const client = {
      models: { generateContent: vi.fn().mockRejectedValue(apiError) },
    };
    let caught: unknown;
    try {
      await decideMenu(baseContext, client as never, {
        max503Retries: 2,
        sleep: async () => {},
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(LLMUnavailableError);
    expect(client.models.generateContent).toHaveBeenCalledTimes(3);
  });
});
