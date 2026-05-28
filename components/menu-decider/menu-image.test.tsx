import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MenuImage } from "./menu-image";

vi.mock("next/image", () => ({
  __esModule: true,
  default: ({
    onError,
    alt,
    src,
  }: {
    onError?: () => void;
    alt: string;
    src: string;
  }) => (
    <img
      alt={alt}
      src={src}
      data-testid="next-image"
      onError={onError}
    />
  ),
}));

describe("MenuImage", () => {
  it("renders the first candidate path with the menu name as alt (Invariant: image renders when available)", () => {
    render(<MenuImage menu="칼국수" />);
    const img = screen.getByTestId("next-image") as HTMLImageElement;
    expect(img.alt).toBe("칼국수");
    expect(img.src).toContain("/menu-images/%EC%B9%BC%EA%B5%AD%EC%88%98.jpg");
  });

  it("falls back to Utensils icon when all image candidates fail to load (Acceptance: missing-image fallback)", () => {
    render(<MenuImage menu="없는메뉴" />);
    const img = screen.getByTestId("next-image");
    // 모든 후보(jpg/png/webp) onError 발생 — 3번
    fireEvent.error(img);
    fireEvent.error(screen.getByTestId("next-image"));
    fireEvent.error(screen.getByTestId("next-image"));
    expect(
      screen.getByTestId("menu-image-fallback"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("next-image")).toBeNull();
  });
});
