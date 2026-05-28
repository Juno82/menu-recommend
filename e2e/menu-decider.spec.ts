import { expect, test } from "@playwright/test";

/**
 * Scenario 3 (Geolocation 거부) e2e
 *
 * 외부 API(Anthropic, Kakao Local, Open-Meteo)는 Server Action 또는 클라이언트
 * 사이드 모두에서 호출되어 안정적 mock이 어렵다. 본 spec은 외부 API 호출이
 * 트리거되지 않는 분기(위치 권한 거부 시 region-input 표시)만 검증한다.
 *
 * Scenario 1, 5, 6 등 외부 API 호출이 필요한 시나리오는 vitest 통합 테스트로 커버.
 */
test("denied geolocation surfaces the region input fallback (Scenario 3)", async ({
  browser,
}) => {
  const context = await browser.newContext({
    permissions: [], // 위치 권한 명시적으로 미부여
    geolocation: undefined,
  });
  const page = await context.newPage();
  await page.goto("/");

  // useGeolocation은 getCurrentPosition 호출 → 권한 없어 onError 호출 → status: "denied"
  // 단, Playwright Chromium은 권한 미부여 시 즉시 error 없이 timeout 가능 — 10초 timeout 안에 fallback 표시 확인
  await expect(page.getByText(/위치 정보를 사용할 수 없어요/)).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByLabel("지역명")).toBeVisible();

  await context.close();
});
