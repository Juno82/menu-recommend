import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Weather } from "@/types/menu-decider";
import Page from "./page";

vi.mock("@/app/actions/decide-menu", () => ({
  decideMenuAction: vi.fn(),
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
const { useGeolocation } = await import("@/hooks/use-geolocation");
const { fetchWeather } = await import("@/lib/weather");
const { getTimeOfDay } = await import("@/lib/time-of-day");

const mockedDecide = vi.mocked(decideMenuAction);
const mockedGeo = vi.mocked(useGeolocation);
const mockedWeather = vi.mocked(fetchWeather);
const mockedTimeOfDay = vi.mocked(getTimeOfDay);

beforeEach(() => {
  mockedDecide.mockReset();
  mockedGeo.mockReset();
  mockedWeather.mockReset();
  mockedTimeOfDay.mockReset();

  mockedGeo.mockReturnValue({
    status: "granted",
    coords: { lat: 37.5, lng: 127 },
  });
  mockedWeather.mockResolvedValue({ condition: "흐림", tempC: 18 });
  mockedTimeOfDay.mockReturnValue("점심");
});

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
