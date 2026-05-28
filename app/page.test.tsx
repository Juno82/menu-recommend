import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Restaurant, Weather } from "@/types/menu-decider";
import Page from "./page";

vi.mock("@/app/actions/decide-menu", () => ({
  decideMenuAction: vi.fn(),
}));
vi.mock("@/app/actions/search-restaurants", () => ({
  searchRestaurantsAction: vi.fn(),
}));
vi.mock("@/app/actions/estimate-menus", () => ({
  estimateMenusAction: vi.fn(),
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
const { estimateMenusAction } = await import("@/app/actions/estimate-menus");
const { useGeolocation } = await import("@/hooks/use-geolocation");
const { fetchWeather } = await import("@/lib/weather");
const { getTimeOfDay } = await import("@/lib/time-of-day");

const mockedDecide = vi.mocked(decideMenuAction);
const mockedSearch = vi.mocked(searchRestaurantsAction);
const mockedEstimate = vi.mocked(estimateMenusAction);
const mockedGeo = vi.mocked(useGeolocation);
const mockedWeather = vi.mocked(fetchWeather);
const mockedTimeOfDay = vi.mocked(getTimeOfDay);

beforeEach(() => {
  mockedDecide.mockReset();
  mockedSearch.mockReset();
  mockedEstimate.mockReset();
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
  mockedEstimate.mockResolvedValue([]);
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
    mockedDecide.mockResolvedValue({
      menu: "칼국수",
      reason: "비 오는 점심엔 따끈한 칼국수",
    });
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
    mockedDecide.mockResolvedValue({ menu: "된장찌개", reason: "쌀쌀한 점심엔 든든하게" });
    const user = userEvent.setup();
    render(<Page />);
    await waitForWeatherReady();

    await user.click(screen.getByRole("button", { name: /추천받기/ }));

    await waitFor(() => expect(screen.getByText("된장찌개")).toBeInTheDocument());
    expect(screen.queryByText(/입력해\s?주세요/)).not.toBeInTheDocument();
    expect(screen.queryByText(/필수/)).not.toBeInTheDocument();
  });

  it("passes the prompt input value to the Server Action", async () => {
    mockedDecide.mockResolvedValue({ menu: "샐러드", reason: "느끼함을 피해 가볍게" });
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
    mockedDecide.mockResolvedValue({ menu: "칼국수", reason: "테스트 이유" });
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
    mockedDecide.mockResolvedValue({
      menu: "칼국수",
      reason: "비 오는 점심엔 따끈한 칼국수 어때요",
    });
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
    mockedDecide.mockRejectedValue(new Error("LLM unavailable"));
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
    mockedDecide.mockRejectedValue(new Error("LLM unavailable"));
    const user = userEvent.setup();
    render(<Page />);
    await waitForWeatherReady();

    await user.click(screen.getByRole("button", { name: /추천받기/ }));
    await waitFor(() => screen.getByText(/추천을 불러오지 못했습니다/));

    expect(screen.queryByText("오늘의 메뉴")).not.toBeInTheDocument();
  });

  it("re-invokes decide-menu with the same prompt when '다시 시도' is clicked", async () => {
    mockedDecide
      .mockRejectedValueOnce(new Error("first fail"))
      .mockResolvedValueOnce({ menu: "칼국수", reason: "비 오는 점심엔 칼국수" });
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
    mockedDecide.mockResolvedValue({ menu: "칼국수", reason: "비 오는 점심엔 칼국수" });
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
    mockedDecide.mockResolvedValue({ menu: "칼국수", reason: "이유" });
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
    mockedDecide.mockResolvedValue({ menu: "칼국수", reason: "이유" });
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

describe("Page — Task 5 (식당별 추정 메뉴 LLM)", () => {
  it("displays estimated menu items with priceWon after estimateMenusAction resolves", async () => {
    mockedDecide.mockResolvedValue({ menu: "칼국수", reason: "이유" });
    mockedSearch.mockResolvedValue(sampleRestaurants);
    mockedEstimate.mockResolvedValue([
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
    mockedDecide.mockResolvedValue({ menu: "칼국수", reason: "이유" });
    mockedSearch.mockResolvedValue(sampleRestaurants);
    mockedEstimate.mockResolvedValue([]);
    const user = userEvent.setup();
    render(<Page />);
    await waitForWeatherReady();

    await user.click(screen.getByRole("button", { name: /추천받기/ }));
    await waitFor(() => screen.getByText("김씨네 칼국수"));

    const disclaimers = screen.getAllByText(/AI 추정값입니다.+가게에서 확인/);
    expect(disclaimers).toHaveLength(3);
  });
});

describe("Page — Task 6 (카카오맵 지도)", () => {
  it("renders the map container alongside restaurant cards", async () => {
    mockedDecide.mockResolvedValue({ menu: "칼국수", reason: "이유" });
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
    mockedDecide.mockResolvedValue({ menu: "냉면", reason: "이유" });
    mockedSearch.mockResolvedValue([]);
    const user = userEvent.setup();
    render(<Page />);
    await waitForWeatherReady();

    await user.click(screen.getByRole("button", { name: /추천받기/ }));
    await waitFor(() => expect(mockedSearch).toHaveBeenCalled());

    expect(screen.queryByTestId("restaurant-map")).not.toBeInTheDocument();
  });
});
