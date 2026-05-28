---
category: tooling
applied: rule
---
## Vitest가 e2e 디렉토리를 픽업해 Playwright와 충돌

**상황**: Task 1 마지막 `bun run test` 첫 실행. Vitest가 `e2e/smoke.spec.ts`를 발견해 Playwright `test()` 호출을 실행 → "Playwright Test did not expect test() to be called here" 에러.
**판단**: `vitest.config.ts` `exclude`에 `"e2e/**"` 추가. Vitest와 Playwright가 같은 레포에 공존할 때 흔히 마주칠 패턴 — 새 프로젝트 boilerplate에 미리 넣자.
**다시 마주칠 가능성**: 높음 — Vitest + Playwright 조합은 표준 셋업. 다른 feature·다른 레포에서도 같은 함정. **`.claude/rules/`로 승격 가치 있음** — vitest config에 e2e exclude 기본 포함 권고.

---
category: spec-ambiguity
applied: not-yet
---
## Server Action 의존 시나리오는 Playwright e2e mock이 사실상 불가능

**상황**: Task 10 진행 중. plan에서 Scenario 1·3·5·6 4개를 Playwright로 검증하기로 했으나, Anthropic SDK·Kakao Local 호출이 Server Action 안에서 일어남 → 클라이언트 `page.route()`로 가로채기 불가.
**판단**: e2e 4개 중 외부 API 호출이 없는 Scenario 3(위치 거부 → region input)만 e2e로 커버. 나머지는 vitest 통합 테스트(`app/page.test.tsx`)가 같은 단언을 이미 검증함을 plan에 명시하고 partial(-) 표기. MSW(Mock Service Worker)나 환경변수 기반 fixture 토글이 진정한 해결이지만 MVP 비용 초과.
**다시 마주칠 가능성**: 중간 — Next.js App Router + Server Action 패턴이 표준화될수록 같은 함정 반복. plan-reviewer에서 "e2e에서 Server Action 호출 시나리오"는 별도 mocking 전략 요구하는 가드를 추가하면 좋을 듯.

---
category: spec-ambiguity
applied: discarded
---
## 카카오 로컬 API는 메뉴 단위 데이터를 주지 않음 (idea.md 단계에서 발견)

**상황**: idea-refine 단계에서 카카오 로컬 API가 식당명·카테고리만 제공하고 메뉴/가격은 미제공임을 확인. 사용자 원안의 "메뉴 사진·가격"을 그대로 구현 불가.
**판단**: LLM 추정 생성으로 우회. hallucination 위험은 영구 disclaimer로 투명화. idea.md / spec.md 불변규칙에 명시.
**다시 마주칠 가능성**: 낮음 — 이 feature 특유. 메뉴 단위 데이터 소스 선택은 도메인별 고유 결정.

---
category: task-ordering
applied: rule
---
## plan-reviewer Suggestion 3 (Task 8 분리해 LLM 실패 앞당기기) 채택이 실제로 효과 있었다

**상황**: 초기 plan은 에러 처리(Scenario 6)를 Task 8(에러+빈) 통합에 두었음. plan-reviewer가 fail-fast 관점에서 LLM 실패를 Task 3으로 앞당기길 권유. 수용.
**판단**: Task 3에서 LLM 실패 처리를 한 vertical slice로 끝낸 결과, Checkpoint 1에서 LLM 통합 위험이 일찍 시각화됨. Task 1·2 후에 곧바로 "실 동작 + 에러 분기 양쪽" end-to-end 검증 가능했음.
**다시 마주칠 가능성**: 높음 — 외부 API 통합이 있는 모든 feature에 적용. 에러 분기는 happy path 직후 vertical slice로 다루는 패턴이 fail-fast 원칙과 부합.

---
category: refactor
applied: not-yet
---
## services/{menu-decider, restaurant-menu-estimator}-service.ts에 LLM 호출 패턴 중복

**상황**: Task 1과 Task 5에서 비슷한 패턴 — `LLMClient` 타입, `extractText`, JSON 파싱 helper. 약 20-30줄 중복.
**판단**: Task 5 진행 중에 인지했으나 같은 커밋 안에서 simplify하면 Task 경계가 흐려져 미뤘다. Step 5 code-reviewer 단계에서 `/simplify` 트리거 후보로 가져갈 만함. 두 서비스가 더 늘면 (Task 11 같은 가상의 3차 LLM 호출) `lib/llm-client.ts`로 추상화.
**다시 마주칠 가능성**: 중간 — LLM 통합 여러 곳에서 발생하는 일반 패턴.
