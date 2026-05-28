import { expect, test } from "@playwright/test";

test("home page loads with the menu decider title", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Menu Decider/);
});

test("input page shows the headline and prompt field", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "오늘 뭐 먹지?" })).toBeVisible();
  await expect(page.getByLabel("조건 (선택)")).toBeVisible();
  await expect(page.getByRole("button", { name: /추천받기/ })).toBeVisible();
});
