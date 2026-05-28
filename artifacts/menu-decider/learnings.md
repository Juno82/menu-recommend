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
applied: rule
---
## LLM 제공자 swap (Anthropic → Gemini)이 추상화 덕분에 ~10분 만에 완료

**상황**: Step 5 후 사용자 요청으로 LLM 제공자를 Anthropic Claude → Google Gemini로 전환. SDK·환경변수·모델명·테스트 mock 형태 모두 달라짐.
**판단**: `lib/llm-client.ts` 추상화(LLMClient 타입 + extractText)가 이미 추출돼 있어 두 service + 두 service 테스트만 바꿈. `app/page.tsx`나 다른 레이어는 무변경. mock 형태도 `messages.create({ content: [{ type, text }] })` → `models.generateContent({ text })`로 더 단순화됨.
**다시 마주칠 가능성**: 중간 — 외부 SDK 변경/공급자 전환은 자주 발생. **일반화 규칙**: 외부 SDK는 항상 `lib/<provider>-client.ts` 같은 얇은 추상화 레이어를 거쳐서 쓴다. SDK 타입을 service 안에 직접 노출하지 않는다.

---
category: refactor
applied: rule
---
## LLM 호출 패턴 중복 → lib/llm-client.ts 추출 (code-reviewer S-1 채택)

**상황**: Task 1과 Task 5에서 `LLMClient` 타입, `extractText`, `MessagesResponse` alias가 두 서비스에 복제. code-reviewer가 S-1으로 다시 지적해 패턴 인식 임계점 도달.
**판단**: Step 4 후 `lib/llm-client.ts`로 `LLMClient` 타입 + `extractText` 함수 추출. 두 서비스 모두 import로 교체. 새 LLM 서비스 도입 시 추가 호출 헬퍼는 모두 lib에 집중.
**다시 마주칠 가능성**: 높음 — LLM 통합 여러 곳에서 반복. **일반화 규칙**: 비슷한 호출 패턴이 2번째 발생 시 즉시 lib로 추출. 3번째에 미루지 말 것.

---
category: code-review
applied: rule
---
## 인라인 ternary 결과값을 useEffect deps에 두지 말 것 (code-reviewer I-1)

**상황**: `const activeCoords = geo.status === "granted" ? geo.coords : resolvedRegion?.coords ?? null`을 직접 useEffect deps로 사용 → 렌더마다 새 객체 ref → 날씨/식당/지도 useEffect가 매 리렌더마다 재실행될 위험.
**판단**: `useMemo`로 활성 좌표/지역 라벨 모두 안정화. 현재 사용 패턴에선 체감 증상 없었으나 향후 state 추가 시 표면화 가능.
**다시 마주칠 가능성**: 높음 — React 컴포넌트에서 흔한 함정. **일반화 규칙**: useEffect deps에 ternary/spread/object literal 결과가 들어가면 useMemo로 안정화.

---
category: code-review
applied: rule
---
## 외부 API 실패에 항상 fallback 또는 사용자 노출 (code-reviewer I-2, I-4, S-5)

**상황**: `fetchWeather.catch(() => {})`로 silent fail → weather가 영원히 undefined → 추천받기 영구 비활성. 비슷하게 estimator 실패도 사일런트 → "추정 메뉴 로딩 중..." 고착. estimator의 restaurantId 무결성도 미검증.
**판단**: weather 실패는 sentinel `{ condition: "정보 없음", tempC: 0 }`로 fallback해 UI 진행 유지. estimator 실패는 `estimateError` state로 사용자 안내 표시. estimator는 validIds Set으로 응답 무결성 검증.
**다시 마주칠 가능성**: 높음 — 외부 API 통합 시 흔한 함정. **일반화 규칙**: `.catch(() => {})` 패턴 금지. 항상 ① 사용자 노출 또는 ② sentinel fallback 둘 중 하나.

---
category: code-review
applied: rule
---
## 비동기 콜백 cleanup은 hook에도 일관되게 (code-reviewer I-3)

**상황**: `app/page.tsx`의 모든 useEffect는 `cancelled` flag로 unmount 후 setState를 방지하나, `hooks/use-geolocation.ts`만 cleanup 누락. `navigator.geolocation.getCurrentPosition` 콜백이 unmount 후 도착 시 setState 호출.
**판단**: hook에도 동일 cleanup 패턴 적용. cleanup이 컴포넌트 useEffect에만 있는 게 아니라 hook의 useEffect에도 동등하게 필요.
**다시 마주칠 가능성**: 중간 — hook 작성 시 자주 잊는 패턴.
