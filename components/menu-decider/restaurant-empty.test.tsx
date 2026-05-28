import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RestaurantEmpty } from "./restaurant-empty";

describe("RestaurantEmpty", () => {
  it("shows the not-found message with the menu name", () => {
    render(<RestaurantEmpty menuName="평양냉면" />);
    expect(
      screen.getByText(/근처에서 평양냉면 식당을 찾지 못했습니다/),
    ).toBeInTheDocument();
  });

  it("renders a Kakao Map external link with the menu encoded in the query", () => {
    render(<RestaurantEmpty menuName="평양냉면" />);
    const link = screen.getByRole("link", { name: /카카오맵에서.+검색/ });
    expect(link).toHaveAttribute(
      "href",
      `https://map.kakao.com/?q=${encodeURIComponent("평양냉면")}`,
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });
});
