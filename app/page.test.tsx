import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MenuRecommendation, Restaurant, Weather } from "@/types/menu-decider";
import Page from "./page";

const ok = (recommendation: MenuRecommendation) =>
  ({ ok: true as const, recommendation });
const failUnknown = () => ({ ok: false as const, reason: "unknown" as const });

vi.mock("@/app/actions/decide-menu", () => ({
  decideMenuAction: vi.fn(),
}));
vi.mock("@/app/actions/search-restaurants", () => ({
  searchRestaurantsAction: vi.fn(),
}));
vi.mock("@/app/actions/fetch-restaurant-menus", () => ({
  fetchRestaurantMenusAction: vi.fn(),
}));
vi.mock("@/app/actions/resolve-region", () => ({
  resolveRegionAction: vi.fn(),
}));
vi.mock("@/hooks/use-geolocation", () => ({
  useGeolocation: vi.fn(),
}));
vi.mock("@/lib/weather", () => ({
  fetchWeather: vi.fn(),
}));
vi.mock("@/lib/time-of-day", () => ({
  getTimeOfDay: vi.fn(),
}));

const { decideMenuAction } = await import("@/app/actions/decide-menu");
const { searchRestaurantsAction } = await import("@/app/actions/search-restaurants");
const { fetchRestaurantMenusAction } = await import(
  "@/app/actions/fetch-restaurant-menus"
);
const { resolveRegionAction } = await import("@/app/actions/resolve-region");
const { useGeolocation } = await import("@/hooks/use-geolocation");
const { fetchWeather } = await import("@/lib/weather");
const { getTimeOfDay } = await import("@/lib/time-of-day");

const mockedDecide = vi.mocked(decideMenuAction);
const mockedSearch = vi.mocked(searchRestaurantsAction);
const mockedFetchMenus = vi.mocked(fetchRestaurantMenusAction);
const mockedResolveRegion = vi.mocked(resolveRegionAction);
const mockedGeo = vi.mocked(useGeolocation);
const mockedWeather = vi.mocked(fetchWeather);
const mockedTimeOfDay = vi.mocked(getTimeOfDay);

beforeEach(() => {
  mockedDecide.mockReset();
  mockedSearch.mockReset();
  mockedFetchMenus.mockReset();
  mockedResolveRegion.mockReset();
  mockedGeo.mockReset();
  mockedWeather.mockReset();
  mockedTimeOfDay.mockReset();

  mockedGeo.mockReturnValue({
    status: "granted",
    coords: { lat: 37.5, lng: 127 },
  });
  mockedWeather.mockResolvedValue({ condition: "흐림", tempC: 18 });
  mockedTimeOfDay.mockReturnValue("점심");
  mockedSearch.mockResolvedValue([]);
  mockedFetchMenus.mockResolvedValue([]);
});

const sampleRestaurants: Restaurant[] = [
  {
    id: "1",
    name: "김씨네 칼국수",
    categoryName: "한식 · 칼국수",
    distanceMeters: 400,
    kakaoUrl: "https://place.map.kakao.com/1",
    coords: { lat: 37.5, lng: 127 },
  },
  {
    id: "2",
    name: "손칼국수 명가",
    categoryName: "한식 · 칼국수",
    distanceMeters: 640,
    kakaoUrl: "https://place.map.kakao.com/2",
    coords: { lat: 37.5, lng: 127 },
  },
  {
    id: "3",
    name: "일미옥",
    categoryName: "한식 · 분식",
    distanceMeters: 950,
    kakaoUrl: "https://place.map.kakao.com/3",
    coords: { lat: 37.5, lng: 127 },
  },
];

async function waitForWeatherReady() {
  await waitFor(() => expect(screen.getByText(/흐림 18°C/)).toBeInTheDocument());
}

describe("Page — Task 1 (메뉴 결정 + 메뉴 카드)", () => {
  it("shows menu card with menu name and reason within 3 seconds after '추천받기'", async () => {
    mockedDecide.mockResolvedValue(
      ok({ menu: "칼국수", reason: "비 오는 점심엔 따끈한 칼국수" }),
    );
    const user = userEvent.setup();
    render(<Page />);
    await waitForWeatherReady();

    await user.click(screen.getByRole("button", { name: /추천받기/ }));

    await waitFor(
      () => expect(screen.getByText("칼국수")).toBeInTheDocument(),
      { timeout: 3000 },
    );
    expect(screen.getByText("비 오는 점심엔 따끈한 칼국수")).toBeInTheDocument();
  });

  it("submits with empty prompt without validation error", async () => {
    mockedDecide.mockResolvedValue(ok({ menu: "된장찌개", reason: "쌀쌀한 점심엔 든든하게" }));
    const user = userEvent.setup();
    render(<Page />);
    await waitForWeatherReady();

    await user.click(screen.getByRole("button", { name: /추천받기/ }));

    await waitFor(() => expect(screen.getByText("된장찌개")).toBeInTheDocument());
    expect(screen.queryByText(/입력해\s?주세요/)).not.toBeInTheDocument();
    expect(screen.queryByText(/필수/)).not.toBeInTheDocument();
  });

  it("passes the prompt input value to the Server Action", async () => {
    mockedDecide.mockResolvedValue(ok({ menu: "샐러드", reason: "느끼함을 피해 가볍게" }));
    const user = userEvent.setup();
    render(<Page />);
    await waitForWeatherReady();

    await user.type(screen.getByLabelText(/조건/), "느끼한 거 빼고");
    await user.click(screen.getByRole("button", { name: /추천받기/ }));

    await waitFor(() => expect(mockedDecide).toHaveBeenCalledTimes(1));
    const calledWith = mockedDecide.mock.calls[0]?.[0];
    expect(calledWith?.prompt).toBe("느끼한 거 빼고");
  });

  it("clicking '조건 다시 입력' clears the recommendation and shows the input form again", async () => {
    mockedDecide.mockResolvedValue(ok({ menu: "칼국수", reason: "테스트 이유" }));
    const user = userEvent.setup();
    render(<Page />);
    await waitForWeatherReady();

    await user.click(screen.getByRole("button", { name: /추천받기/ }));
    await waitFor(() => expect(screen.getByText("칼국수")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /조건 다시 입력/ }));

    expect(screen.queryByText("칼국수")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /추천받기/ })).toBeInTheDocument();
    expect(screen.getByLabelText(/조건/)).toBeInTheDocument();
  });
});

describe("Page — Task 2 (자동 수집)", () => {
  it("displays weather text in the context card after location is granted", async () => {
    render(<Page />);
    await waitFor(() => expect(screen.getByText(/흐림 18°C/)).toBeInTheDocument());
  });

  it("displays the time-of-day label in the context card", () => {
    mockedTimeOfDay.mockReturnValue("점심");
    render(<Page />);
    expect(screen.getByText("점심")).toBeInTheDocument();
  });

  it("shows the weather loading indicator until fetchWeather resolves", async () => {
    let resolveWeather: (w: Weather) => void = () => {};
    mockedWeather.mockReturnValue(
      new Promise<Weather>((resolve) => {
        resolveWeather = resolve;
      }),
    );

    render(<Page />);
    expect(screen.getByText(/날씨 정보 확인 중/)).toBeInTheDocument();

    resolveWeather({ condition: "맑음", tempC: 22 });
    await waitFor(() => expect(screen.getByText(/맑음 22°C/)).toBeInTheDocument());
    expect(screen.queryByText(/날씨 정보 확인 중/)).not.toBeInTheDocument();
  });

  it("menu card reason includes a weather or time-of-day cue (Scenario 2 success [3])", async () => {
    mockedDecide.mockResolvedValue(
      ok({ menu: "칼국수", reason: "비 오는 점심엔 따끈한 칼국수 어때요" }),
    );
    const user = userEvent.setup();
    render(<Page />);
    await waitForWeatherReady();

    await user.click(screen.getByRole("button", { name: /추천받기/ }));
    await waitFor(() => expect(screen.getByText("칼국수")).toBeInTheDocument());

    const reasonNode = screen.getByText(
      /(맑음|흐림|비|눈|안개|이슬비|천둥|아침|점심|저녁|야식|쌀쌀|따끈|시원|더운|추운|선선)/,
    );
    expect(reasonNode).toBeInTheDocument();
  });
});

describe("Page — Task 3 (LLM 실패 처리)", () => {
  it("shows the error card and a '다시 시도' button when decideMenuAction rejects (Scenario 6)", async () => {
    mockedDecide.mockResolvedValue(failUnknown());
    const user = userEvent.setup();
    render(<Page />);
    await waitForWeatherReady();

    await user.click(screen.getByRole("button", { name: /추천받기/ }));

    await waitFor(() =>
      expect(screen.getByText(/추천을 불러오지 못했습니다/)).toBeInTheDocument(),
    );
    expect(screen.getByText(/잠시 후 다시 시도해 주세요/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /다시 시도/ })).toBeInTheDocument();
  });

  it("does not render the menu card area in the error state", async () => {
    mockedDecide.mockResolvedValue(failUnknown());
    const user = userEvent.setup();
    render(<Page />);
    await waitForWeatherReady();

    await user.click(screen.getByRole("button", { name: /추천받기/ }));
    await waitFor(() => screen.getByText(/추천을 불러오지 못했습니다/));

    expect(screen.queryByText("오늘의 메뉴")).not.toBeInTheDocument();
  });

  it("shows the rate-limit message with retryAfterSeconds when decide returns rate_limit", async () => {
    mockedDecide.mockResolvedValue({
      ok: false,
      reason: "rate_limit",
      retryAfterSeconds: 39,
    });
    const user = userEvent.setup();
    render(<Page />);
    await waitForWeatherReady();

    await user.click(screen.getByRole("button", { name: /추천받기/ }));

    await waitFor(() =>
      expect(screen.getByText(/지금은 추천이 어려워요/)).toBeInTheDocument(),
    );
    expect(screen.getByText(/약 39초 뒤 다시 시도/)).toBeInTheDocument();
  });

  it("shows the unavailable message when decide returns unavailable", async () => {
    mockedDecide.mockResolvedValue({ ok: false, reason: "unavailable" });
    const user = userEvent.setup();
    render(<Page />);
    await waitForWeatherReady();

    await user.click(screen.getByRole("button", { name: /추천받기/ }));

    await waitFor(() =>
      expect(screen.getByText(/Gemini가 일시적으로 혼잡합니다/)).toBeInTheDocument(),
    );
  });

  it("re-invokes decide-menu with the same prompt when '다시 시도' is clicked", async () => {
    mockedDecide
      .mockResolvedValueOnce(failUnknown())
      .mockResolvedValueOnce(ok({ menu: "칼국수", reason: "비 오는 점심엔 칼국수" }));
    const user = userEvent.setup();
    render(<Page />);
    await waitForWeatherReady();

    await user.type(screen.getByLabelText(/조건/), "해장");
    await user.click(screen.getByRole("button", { name: /추천받기/ }));
    await waitFor(() => screen.getByText(/추천을 불러오지 못했습니다/));

    await user.click(screen.getByRole("button", { name: /다시 시도/ }));

    await waitFor(() => expect(screen.getByText("칼국수")).toBeInTheDocument());
    expect(mockedDecide).toHaveBeenCalledTimes(2);
    expect(mockedDecide.mock.calls[0]?.[0].prompt).toBe("해장");
    expect(mockedDecide.mock.calls[1]?.[0].prompt).toBe("해장");
  });
});

describe("Page — Task 4 (식당 검색 + 스켈레톤)", () => {
  it("shows restaurant skeletons after the menu card while restaurants are loading", async () => {
    mockedDecide.mockResolvedValue(ok({ menu: "칼국수", reason: "비 오는 점심엔 칼국수" }));
    let resolveSearch: (rs: Restaurant[]) => void = () => {};
    mockedSearch.mockReturnValue(
      new Promise<Restaurant[]>((r) => {
        resolveSearch = r;
      }),
    );
    const user = userEvent.setup();
    render(<Page />);
    await waitForWeatherReady();

    await user.click(screen.getByRole("button", { name: /추천받기/ }));
    await waitFor(() => screen.getByText("칼국수"));

    expect(screen.getByTestId("restaurant-skeleton-list")).toBeInTheDocument();
    expect(screen.queryByText("김씨네 칼국수")).not.toBeInTheDocument();

    resolveSearch(sampleRestaurants);

    await waitFor(() => screen.getByText("김씨네 칼국수"));
    expect(screen.queryByTestId("restaurant-skeleton-list")).not.toBeInTheDocument();
  });

  it("menu card appears before restaurant cards (Invariant: result order)", async () => {
    mockedDecide.mockResolvedValue(ok({ menu: "칼국수", reason: "이유" }));
    let resolveSearch: (rs: Restaurant[]) => void = () => {};
    mockedSearch.mockReturnValue(
      new Promise<Restaurant[]>((r) => {
        resolveSearch = r;
      }),
    );
    const user = userEvent.setup();
    render(<Page />);
    await waitForWeatherReady();

    await user.click(screen.getByRole("button", { name: /추천받기/ }));
    await waitFor(() => screen.getByText("칼국수"));
    expect(screen.queryByText("김씨네 칼국수")).not.toBeInTheDocument();

    resolveSearch(sampleRestaurants);
    await waitFor(() => screen.getByText("김씨네 칼국수"));
  });

  it("each restaurant card has name, walking distance, and a kakao link (target=_blank)", async () => {
    mockedDecide.mockResolvedValue(ok({ menu: "칼국수", reason: "이유" }));
    mockedSearch.mockResolvedValue(sampleRestaurants);
    const user = userEvent.setup();
    render(<Page />);
    await waitForWeatherReady();

    await user.click(screen.getByRole("button", { name: /추천받기/ }));
    await waitFor(() => screen.getByText("김씨네 칼국수"));

    expect(screen.getByText("도보 5분")).toBeInTheDocument();
    expect(screen.getByText("도보 8분")).toBeInTheDocument();
    expect(screen.getByText("도보 12분")).toBeInTheDocument();

    const links = screen.getAllByRole("link", { name: /카카오맵에서 보기/ });
    expect(links).toHaveLength(3);
    expect(links[0]).toHaveAttribute("target", "_blank");
    expect(links[0]).toHaveAttribute("href", "https://place.map.kakao.com/1");
  });
});

describe("Page — Task 5 (식당별 카카오 등록 메뉴)", () => {
  it("displays menu items with priceWon after fetchRestaurantMenusAction resolves", async () => {
    mockedDecide.mockResolvedValue(ok({ menu: "칼국수", reason: "이유" }));
    mockedSearch.mockResolvedValue(sampleRestaurants);
    mockedFetchMenus.mockResolvedValue([
      {
        restaurantId: "1",
        items: [
          { name: "해물칼국수", priceWon: "9,000원" },
          { name: "들깨칼국수", priceWon: "8,500원" },
        ],
      },
      {
        restaurantId: "2",
        items: [{ name: "사골칼국수", priceWon: "11,000원" }],
      },
      {
        restaurantId: "3",
        items: [{ name: "잔치국수", priceWon: "7,500원" }],
      },
    ]);
    const user = userEvent.setup();
    render(<Page />);
    await waitForWeatherReady();

    await user.click(screen.getByRole("button", { name: /추천받기/ }));
    await waitFor(() => screen.getByText("해물칼국수"));

    expect(screen.getByText("9,000원")).toBeInTheDocument();
    expect(screen.getByText("들깨칼국수")).toBeInTheDocument();
    expect(screen.getByText("사골칼국수")).toBeInTheDocument();
    expect(screen.getByText("11,000원")).toBeInTheDocument();
  });

  it("renders the disclaimer text on every restaurant card", async () => {
    mockedDecide.mockResolvedValue(ok({ menu: "칼국수", reason: "이유" }));
    mockedSearch.mockResolvedValue(sampleRestaurants);
    mockedFetchMenus.mockResolvedValue([]);
    const user = userEvent.setup();
    render(<Page />);
    await waitForWeatherReady();

    await user.click(screen.getByRole("button", { name: /추천받기/ }));
    await waitFor(() => screen.getByText("김씨네 칼국수"));

    const disclaimers = screen.getAllByText(/카카오맵 등록 정보 기준/);
    expect(disclaimers).toHaveLength(3);
  });
});

describe("Page — Task 6 (카카오맵 지도)", () => {
  it("renders the map container alongside restaurant cards", async () => {
    mockedDecide.mockResolvedValue(ok({ menu: "칼국수", reason: "이유" }));
    mockedSearch.mockResolvedValue(sampleRestaurants);
    const user = userEvent.setup();
    render(<Page />);
    await waitForWeatherReady();

    await user.click(screen.getByRole("button", { name: /추천받기/ }));
    await waitFor(() => screen.getByText("김씨네 칼국수"));

    const map = screen.getByTestId("restaurant-map");
    expect(map).toBeInTheDocument();
    expect(map).toHaveAttribute("aria-label", "식당 위치 지도");
  });

  it("does not render the map when there are no restaurants", async () => {
    mockedDecide.mockResolvedValue(ok({ menu: "냉면", reason: "이유" }));
    mockedSearch.mockResolvedValue([]);
    const user = userEvent.setup();
    render(<Page />);
    await waitForWeatherReady();

    await user.click(screen.getByRole("button", { name: /추천받기/ }));
    await waitFor(() => expect(mockedSearch).toHaveBeenCalled());

    expect(screen.queryByTestId("restaurant-map")).not.toBeInTheDocument();
  });
});

describe("Page — Task 7 (위치 거부 fallback)", () => {
  it("shows the region input with the guidance message when geolocation is denied (Scenario 3)", () => {
    mockedGeo.mockReturnValue({ status: "denied" });
    render(<Page />);
    expect(screen.getByText(/위치 정보를 사용할 수 없어요/)).toBeInTheDocument();
    expect(screen.getByText(/지역을 입력해 주세요/)).toBeInTheDocument();
    expect(screen.getByLabelText(/지역명/)).toBeInTheDocument();
  });

  it("resolves '강남역' and triggers a weather fetch for the resolved coords", async () => {
    mockedGeo.mockReturnValue({ status: "denied" });
    mockedResolveRegion.mockResolvedValue({
      ok: true,
      region: { coords: { lat: 37.4979, lng: 127.0276 }, label: "강남역" },
    });
    const user = userEvent.setup();
    render(<Page />);

    await user.type(screen.getByLabelText(/지역명/), "강남역");
    await user.click(screen.getByRole("button", { name: /^확인/ }));

    await waitFor(() =>
      expect(mockedResolveRegion).toHaveBeenCalledWith("강남역"),
    );
    await waitFor(() =>
      expect(mockedWeather).toHaveBeenCalledWith({ lat: 37.4979, lng: 127.0276 }),
    );
    await waitFor(() => {
      const submit = screen.getByRole("button", { name: /추천받기/ });
      expect(submit).not.toBeDisabled();
    });
  });

  it("shows '지역을 찾을 수 없습니다' when resolveRegionAction returns not_found", async () => {
    mockedGeo.mockReturnValue({ status: "denied" });
    mockedResolveRegion.mockResolvedValue({
      ok: false,
      reason: "not_found",
      message: "Region not found",
    });
    const user = userEvent.setup();
    render(<Page />);

    await user.type(screen.getByLabelText(/지역명/), "존재안함");
    await user.click(screen.getByRole("button", { name: /^확인/ }));

    await waitFor(() =>
      expect(
        screen.getByText(/지역을 찾을 수 없습니다.+다시 입력해 주세요/),
      ).toBeInTheDocument(),
    );
  });
});

describe("Page — Task 8 (다시 추천 + 세션 제외)", () => {
  it("passes previously viewed menus as excludedMenus on re-recommend", async () => {
    mockedDecide
      .mockResolvedValueOnce(ok({ menu: "칼국수", reason: "비 오는 점심" }))
      .mockResolvedValueOnce(ok({ menu: "된장찌개", reason: "쌀쌀한 날 든든하게" }));
    const user = userEvent.setup();
    render(<Page />);
    await waitForWeatherReady();

    await user.click(screen.getByRole("button", { name: /추천받기/ }));
    await waitFor(() => screen.getByText("칼국수"));

    await user.click(screen.getByRole("button", { name: /다시 추천/ }));
    await waitFor(() => screen.getByText("된장찌개"));

    expect(mockedDecide).toHaveBeenCalledTimes(2);
    expect(mockedDecide.mock.calls[0]?.[0].excludedMenus).toEqual([]);
    expect(mockedDecide.mock.calls[1]?.[0].excludedMenus).toEqual(["칼국수"]);
  });

  it("shows the new menu within 3 seconds of clicking 다시 추천", async () => {
    mockedDecide
      .mockResolvedValueOnce(ok({ menu: "칼국수", reason: "이유" }))
      .mockResolvedValueOnce(ok({ menu: "된장찌개", reason: "다른 이유" }));
    const user = userEvent.setup();
    render(<Page />);
    await waitForWeatherReady();

    await user.click(screen.getByRole("button", { name: /추천받기/ }));
    await waitFor(() => screen.getByText("칼국수"));

    await user.click(screen.getByRole("button", { name: /다시 추천/ }));
    await waitFor(
      () => expect(screen.getByText("된장찌개")).toBeInTheDocument(),
      { timeout: 3000 },
    );
  });

  it("shows '새로 추천됨' badge from the second recommendation onward (not on the first)", async () => {
    mockedDecide
      .mockResolvedValueOnce(ok({ menu: "칼국수", reason: "이유 1" }))
      .mockResolvedValueOnce(ok({ menu: "된장찌개", reason: "이유 2" }));
    const user = userEvent.setup();
    render(<Page />);
    await waitForWeatherReady();

    await user.click(screen.getByRole("button", { name: /추천받기/ }));
    await waitFor(() => screen.getByText("칼국수"));
    expect(screen.queryByText("새로 추천됨")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /다시 추천/ }));
    await waitFor(() => screen.getByText("된장찌개"));
    expect(screen.getByText("새로 추천됨")).toBeInTheDocument();
  });

  it("renders previously viewed menus with strikethrough on the menu card", async () => {
    mockedDecide
      .mockResolvedValueOnce(ok({ menu: "칼국수", reason: "이유 1" }))
      .mockResolvedValueOnce(ok({ menu: "된장찌개", reason: "이유 2" }));
    const user = userEvent.setup();
    render(<Page />);
    await waitForWeatherReady();

    await user.click(screen.getByRole("button", { name: /추천받기/ }));
    await waitFor(() => screen.getByText("칼국수"));

    await user.click(screen.getByRole("button", { name: /다시 추천/ }));
    await waitFor(() => screen.getByText("된장찌개"));

    expect(screen.getByText(/이번 세션에서 본 메뉴/)).toBeInTheDocument();
    const previousMenu = screen.getByText("칼국수");
    expect(previousMenu).toHaveClass("line-through");
  });
});

describe("Page — Task 9 (식당 없음 fallback)", () => {
  it("shows restaurant-empty fallback when searchRestaurants returns an empty array (Scenario 4)", async () => {
    mockedDecide.mockResolvedValue(ok({ menu: "평양냉면", reason: "더운 오후엔" }));
    mockedSearch.mockResolvedValue([]);
    const user = userEvent.setup();
    render(<Page />);
    await waitForWeatherReady();

    await user.click(screen.getByRole("button", { name: /추천받기/ }));
    await waitFor(() => screen.getByText("평양냉면"));

    expect(
      screen.getByText(/근처에서 평양냉면 식당을 찾지 못했습니다/),
    ).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /카카오맵에서.+검색/ });
    expect(link).toHaveAttribute(
      "href",
      `https://map.kakao.com/?q=${encodeURIComponent("평양냉면")}`,
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(screen.queryByTestId("restaurant-map")).not.toBeInTheDocument();
  });

  it("shows restaurant-empty fallback when searchRestaurants rejects", async () => {
    mockedDecide.mockResolvedValue(ok({ menu: "평양냉면", reason: "더운 오후엔" }));
    mockedSearch.mockRejectedValue(new Error("kakao api failed"));
    const user = userEvent.setup();
    render(<Page />);
    await waitForWeatherReady();

    await user.click(screen.getByRole("button", { name: /추천받기/ }));
    await waitFor(() => screen.getByText("평양냉면"));

    await waitFor(() =>
      expect(
        screen.getByText(/근처에서 평양냉면 식당을 찾지 못했습니다/),
      ).toBeInTheDocument(),
    );
  });

  it("keeps the menu card visible in the restaurant-empty state", async () => {
    mockedDecide.mockResolvedValue(ok({ menu: "평양냉면", reason: "더운 오후엔" }));
    mockedSearch.mockResolvedValue([]);
    const user = userEvent.setup();
    render(<Page />);
    await waitForWeatherReady();

    await user.click(screen.getByRole("button", { name: /추천받기/ }));
    await waitFor(() => screen.getByText("평양냉면"));

    expect(screen.getByText("평양냉면")).toBeInTheDocument();
    expect(screen.getByText("오늘의 메뉴")).toBeInTheDocument();
  });
});
