import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MenuRecommendation } from "@/types/menu-decider";
import { MenuCard } from "./menu-card";

vi.mock("next/image", () => ({
  __esModule: true,
  default: ({ alt, src }: { alt: string; src: string }) => (
    <img alt={alt} src={src} data-testid="next-image" />
  ),
}));

const recommendation: MenuRecommendation = {
  menu: "김치찌개",
  reason: "쌀쌀한 저녁에 따뜻한 한 끼.",
};

describe("MenuCard with image", () => {
  it("renders the menu image alongside the menu name and reason (Invariant: image+text both present)", () => {
    render(
      <MenuCard
        recommendation={recommendation}
        viewedMenus={["김치찌개"]}
      />,
    );
    const img = screen.getByTestId("next-image") as HTMLImageElement;
    expect(img.alt).toBe("김치찌개");
    expect(screen.getByRole("heading", { name: "김치찌개" })).toBeInTheDocument();
    expect(screen.getByText("쌀쌀한 저녁에 따뜻한 한 끼.")).toBeInTheDocument();
  });
});
