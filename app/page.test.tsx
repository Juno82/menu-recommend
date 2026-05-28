import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Page from "./page";

vi.mock("@/app/actions/decide-menu", () => ({
  decideMenuAction: vi.fn(),
}));

const { decideMenuAction } = await import("@/app/actions/decide-menu");
const mockedDecide = vi.mocked(decideMenuAction);

describe("Page (Task 1)", () => {
  beforeEach(() => {
    mockedDecide.mockReset();
  });

  it("shows menu card with menu name and reason within 3 seconds after '추천받기'", async () => {
    mockedDecide.mockResolvedValue({
      menu: "칼국수",
      reason: "비 오는 점심엔 따끈한 칼국수",
    });
    const user = userEvent.setup();
    render(<Page />);

    await user.click(screen.getByRole("button", { name: /추천받기/ }));

    await waitFor(
      () => expect(screen.getByText("칼국수")).toBeInTheDocument(),
      { timeout: 3000 },
    );
    expect(screen.getByText("비 오는 점심엔 따끈한 칼국수")).toBeInTheDocument();
  });

  it("submits with empty prompt and shows result without validation error", async () => {
    mockedDecide.mockResolvedValue({ menu: "된장찌개", reason: "쌀쌀한 점심엔 든든하게" });
    const user = userEvent.setup();
    render(<Page />);

    await user.click(screen.getByRole("button", { name: /추천받기/ }));

    await waitFor(() => expect(screen.getByText("된장찌개")).toBeInTheDocument());
    expect(screen.queryByText(/입력해\s?주세요/)).not.toBeInTheDocument();
    expect(screen.queryByText(/필수/)).not.toBeInTheDocument();
  });

  it("passes the prompt input value to the Server Action", async () => {
    mockedDecide.mockResolvedValue({ menu: "샐러드", reason: "느끼함을 피해 가볍게" });
    const user = userEvent.setup();
    render(<Page />);

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

    await user.click(screen.getByRole("button", { name: /추천받기/ }));
    await waitFor(() => expect(screen.getByText("칼국수")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /조건 다시 입력/ }));

    expect(screen.queryByText("칼국수")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /추천받기/ })).toBeInTheDocument();
    expect(screen.getByLabelText(/조건/)).toBeInTheDocument();
  });
});
