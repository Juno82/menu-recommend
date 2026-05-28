import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Restaurant, RestaurantMenu } from "@/types/menu-decider";
import { RestaurantCard } from "./restaurant-card";

const sample: Restaurant = {
  id: "1",
  name: "테스트 식당",
  categoryName: "한식",
  distanceMeters: 400,
  kakaoUrl: "https://place.map.kakao.com/1",
  coords: { lat: 0, lng: 0 },
};

describe("RestaurantCard", () => {
  it("always renders the data-source disclaimer (Invariant: transparency about source)", () => {
    render(<RestaurantCard restaurant={sample} pinNumber={1} />);
    expect(
      screen.getByText(/카카오맵 등록 정보 기준이며, 실제와 다를 수 있습니다/),
    ).toBeInTheDocument();
  });

  it("renders the disclaimer even when no menu is provided (no close button)", () => {
    render(<RestaurantCard restaurant={sample} pinNumber={1} />);
    const disclaimer = screen.getByText(/카카오맵 등록 정보 기준/);
    expect(disclaimer).toBeInTheDocument();
    expect(disclaimer.closest("button")).toBeNull();
    expect(disclaimer.closest('[role="dialog"]')).toBeNull();
  });

  it("displays each menu item with name and priceWon", () => {
    const menu: RestaurantMenu = {
      restaurantId: "1",
      items: [
        { name: "해물칼국수", priceWon: "9,000원" },
        { name: "들깨칼국수", priceWon: "8,500원" },
      ],
    };
    render(<RestaurantCard restaurant={sample} pinNumber={1} menu={menu} />);
    expect(screen.getByText("해물칼국수")).toBeInTheDocument();
    expect(screen.getByText("9,000원")).toBeInTheDocument();
    expect(screen.getByText("들깨칼국수")).toBeInTheDocument();
    expect(screen.getByText("8,500원")).toBeInTheDocument();
  });

  it("renders the kakao map external link with target=_blank", () => {
    render(<RestaurantCard restaurant={sample} pinNumber={1} />);
    const link = screen.getByRole("link", { name: /카카오맵에서 보기/ });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("href", "https://place.map.kakao.com/1");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });
});
