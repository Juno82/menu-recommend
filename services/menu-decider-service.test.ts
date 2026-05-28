import { describe, expect, it, vi } from "vitest";
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
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: "text", text }],
      }),
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
    const call = client.messages.create.mock.calls[0]?.[0] as {
      messages: { content: string }[];
    };
    const userMessage = call.messages[0].content;
    expect(userMessage).toContain("흐림");
    expect(userMessage).toContain("18");
    expect(userMessage).toContain("점심");
  });

  it("includes the user prompt in the message when provided", async () => {
    const client = mockClient({ menu: "샐러드" });
    await decideMenu(
      { ...baseContext, prompt: "느끼한 거 빼고" },
      client as never,
    );
    const call = client.messages.create.mock.calls[0]?.[0] as {
      messages: { content: string }[];
    };
    expect(call.messages[0].content).toContain("느끼한 거 빼고");
  });

  it("includes excluded menus and an exclusion hint in the user prompt", async () => {
    const client = mockClient({ menu: "된장찌개" });
    await decideMenu(
      { ...baseContext, excludedMenus: ["칼국수", "라면"] },
      client as never,
    );
    const call = client.messages.create.mock.calls[0]?.[0] as {
      messages: { content: string }[];
    };
    const userMessage = call.messages[0].content;
    expect(userMessage).toContain("칼국수");
    expect(userMessage).toContain("라면");
    expect(userMessage).toContain("제외");
  });

  it("uses ephemeral prompt caching on the menu pool system block", async () => {
    const client = mockClient({ menu: "칼국수" });
    await decideMenu(baseContext, client as never);
    const call = client.messages.create.mock.calls[0]?.[0] as {
      system?: { type: string; text: string; cache_control?: { type: string } }[];
    };
    expect(call.system).toBeDefined();
    expect(call.system?.[0].cache_control?.type).toBe("ephemeral");
  });
});
