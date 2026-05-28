# Menu Decider 구현 계획

## 아키텍처 결정

| 결정 | 선택 | 이유 |
|---|---|---|
| LLM 제공자 | Anthropic Claude | claude-api 스킬 정합, 한국어 자연 생성 품질, prompt caching으로 메뉴 풀 캐싱 가능 |
| LLM 호출 구조 | 두 단계 분리 (메뉴 결정 + 식당별 추정 메뉴) | 불변규칙 "메뉴 카드가 식당보다 먼저 표시" 자연스럽게 충족, 인지 응답 시간 단축 |
| 메뉴 후보 풀 | 사전 정의 한국 메뉴 ~150개 (`config/menu-pool.ts`), LLM은 풀에서 선택만 | hallucination 방지, "이전 메뉴 제외"(S5)가 단순한 set 연산, 평가/디버깅 용이 |
| LLM 호출 위치 | Server Action | ANTHROPIC_API_KEY 보호, Next.js 16 App Router 표준 폼 통합 |
| 카카오 로컬 API 호출 위치 | Server Action | REST 키는 서버 전용 |
| 카카오맵 표시 | 카카오맵 JS SDK + `next/dynamic` (ssr:false) | JS SDK 키는 도메인 화이트리스트로 보호, 클라이언트 전용 |
| 날씨 / Geolocation | 클라이언트 사이드 직접 호출 (Open-Meteo는 무료·키 없음) | 서버 경유 불필요, 응답 빠름 |
| 라우트 구조 | `app/page.tsx` 교체 (기존 example 컴포넌트 제거) | spec의 "단일 페이지" 명시, 백지 상태라 신규 라우트 불필요 |
| 상태 관리 | `useState` + `useTransition` + Server Action | 외부 store 불필요. 세션 `viewedMenus`도 컴포넌트 상태 |
| 위치 데이터 처리 | 서버에 저장 없음 — `services/*.ts`에 DB·외부 저장소 클라이언트 import 금지 (Task 1·7 수용 기준) | 불변규칙 "위치 데이터 처리" — 음성 불변규칙이므로 코드 리뷰 체크로 강제 |

## 인프라 리소스

| 리소스 | 유형 | 선언 위치 | 생성 Task |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Env var (서버 전용) | `.env.local` + `.env.example` | Task 1 |
| `KAKAO_REST_API_KEY` | Env var (서버 전용) | `.env.local` + `.env.example` | Task 4 |
| `NEXT_PUBLIC_KAKAO_JS_KEY` | Env var (클라이언트 노출 허용, 도메인 화이트리스트 보호) | `.env.local` + `.env.example` | Task 6 |

## 데이터 모델

### MenuPoolEntry (`config/menu-pool.ts`)
- `name: string` — 한국어 메뉴명 (예: "칼국수", "된장찌개")
- `category: string` — 분류 (예: "한식·면", "한식·찌개", "중식", "분식")
- `tags?: string[]` — LLM 선택 힌트 (예: "따끈한", "매운", "가벼운", "든든한", "해장")

### RecommendationContext
- `coords: { lat: number, lng: number }`
- `regionLabel: string` — UI 표시용 (예: "서울 강남구")
- `weather: { condition: string, tempC: number }`
- `timeOfDay: "아침" | "점심" | "저녁" | "야식"`
- `prompt?: string` — 사용자 자유 입력 (선택)
- `excludedMenus: string[]` — 같은 세션에서 이미 추천된 메뉴 이름

### MenuRecommendation
- `menu: string` — 풀에서 선택된 메뉴명
- `reason: string` — 한 줄 추천 이유 (날씨·시간대 단서가 자연어로 포함되어야 함 — Task 2 검증)

### Restaurant
- `id: string` — 카카오 place id
- `name: string`
- `categoryName: string`
- `distanceMeters: number`
- `kakaoUrl: string` — `place_url`
- `coords: { lat: number, lng: number }`

### EstimatedRestaurantMenu
- `restaurantId: string`
- `items: { name: string, priceWon: string }[]` — `priceWon`은 "9,000원" 또는 "8,000-10,000원" 형식

## 필요 스킬

| 스킬 | 적용 Task | 용도 |
|---|---|---|
| `claude-api` | Task 1, 5 | Anthropic SDK, prompt caching (메뉴 풀), 모델 선택 |
| `next-best-practices` | 전체 | Next.js 16 App Router, Server Action, RSC 경계 |
| `shadcn` | Task 1, 3, 4, 6, 7, 9 | Card, Button, Input, Badge, Separator 활용 — `components/ui/*` 직접 수정 금지 |
| `vercel-react-best-practices` | 전체 | React 19 최적화 (`useTransition`, 클라이언트 경계 최소화) |
| `vercel-composition-patterns` | Task 4, 6, 9 | 식당 카드·에러 상태·지도 합성 |
| `web-design-guidelines` | Task 1, 3, 4, 9 | 접근성 (label/aria, 키보드), disclaimer 가독성 |

## 영향 받는 파일

| 파일 경로 | 변경 유형 | 관련 Task |
|---|---|---|
| `.env.example` | New | Task 1, 4, 6 |
| `types/menu-decider.ts` | New | Task 1 |
| `config/menu-pool.ts` | New | Task 1 |
| `lib/time-of-day.ts` | New | Task 2 |
| `lib/weather.ts` | New | Task 2 |
| `services/menu-decider-service.ts` | New | Task 1 |
| `services/kakao-local-service.ts` | New | Task 4 |
| `services/restaurant-menu-estimator-service.ts` | New | Task 5 |
| `services/kakao-geocoding-service.ts` | New | Task 7 |
| `hooks/use-geolocation.ts` | New | Task 2 |
| `app/actions/decide-menu.ts` | New | Task 1 |
| `app/actions/search-restaurants.ts` | New | Task 4 |
| `app/actions/estimate-menus.ts` | New | Task 5 |
| `app/actions/resolve-region.ts` | New | Task 7 |
| `app/page.tsx` | Modify (교체) | Task 1, 2, 3, 4, 5, 6, 7, 8, 9 |
| `components/menu-decider/context-display.tsx` | New | Task 2 |
| `components/menu-decider/menu-card.tsx` | New | Task 1, 8 |
| `components/menu-decider/restaurant-card.tsx` | New | Task 4, 5 |
| `components/menu-decider/restaurant-skeleton.tsx` | New | Task 4 |
| `components/menu-decider/restaurant-map.tsx` | New | Task 6 |
| `components/menu-decider/region-input.tsx` | New | Task 7 |
| `components/menu-decider/recommendation-error.tsx` | New | Task 3 |
| `components/menu-decider/restaurant-empty.tsx` | New | Task 9 |
| `app/page.test.tsx` 및 컴포넌트 colocated `*.test.tsx` | New | Task 1-9 |
| `e2e/menu-decider.spec.ts` | New | Task 10 |
| `components/component-example.tsx`, `components/example.tsx` | Delete | Task 1 |

## Tasks

### Task 1: 메뉴 결정 — 입력 폼 → LLM 호출 → 메뉴 카드 표시 (위치/날씨는 hardcoded mock)

- **담당 시나리오**: Scenario 1 (메뉴 카드 부분만), Scenario 2 (빈 프롬프트 — 메뉴 카드 부분만), 불변규칙 "응답 시간", 불변규칙 "위치 데이터 처리"
- **크기**: M (6 파일)
- **의존성**: None
- **참조**:
  - `claude-api` — Anthropic SDK, 메뉴 풀 prompt caching, `claude-haiku-4-5-20251001` 모델, system 프롬프트에 풀 + ephemeral cache
  - `next-best-practices` — Server Action (`"use server"`), 클라이언트 폼 + `useTransition`
  - `shadcn` — Card, Button, Input, Label. `components/ui/*` 직접 수정 금지
  - `artifacts/menu-decider/wireframe.html` — 입력 화면(scenario-1) + 결과 화면 메뉴 카드 영역
- **구현 대상**:
  - `.env.example` (`ANTHROPIC_API_KEY=` 추가)
  - `types/menu-decider.ts` (`MenuPoolEntry`, `RecommendationContext`, `MenuRecommendation`)
  - `config/menu-pool.ts` (~150개 한국 메뉴, 카테고리 + tags)
  - `services/menu-decider-service.ts` (Anthropic SDK 호출, 풀에서 1개 선택 + reason, 응답 JSON 파싱 + 풀 멤버십 검증)
  - `services/menu-decider-service.test.ts` (SDK fetch 모킹, 풀 멤버십 검증, excludedMenus 처리)
  - `app/actions/decide-menu.ts` (Server Action 래퍼)
  - `app/page.tsx` (교체: 자동 수집 카드는 hardcoded "서울 강남구·흐림 18°C·점심", 프롬프트, 추천받기, 메뉴 카드)
  - `components/menu-decider/menu-card.tsx` (메뉴명 + reason + "조건 다시 입력" 버튼 — 클릭 시 결과 상태 초기화 후 입력 폼 복귀)
  - `app/page.test.tsx` (RTL: 추천받기 → mock Server Action → 메뉴 카드 단언)
  - `components/component-example.tsx`, `components/example.tsx` 삭제
- **수용 기준**:
  - [x] "추천받기" 클릭 → 모킹된 LLM 응답이 메뉴 카드 영역에 메뉴명과 한 줄 이유 텍스트로 표시된다
  - [x] "추천받기" 클릭부터 메뉴 카드 텍스트가 화면에 표시되기까지 **3초 이내**(`waitFor(..., { timeout: 3000 })` 단언)
  - [x] 빈 프롬프트 + "추천받기" → 유효성 에러 없이 메뉴 카드가 표시된다
  - [x] `services/menu-decider-service.ts`가 풀 밖 메뉴를 반환하면 호출자가 에러를 받는다
  - [x] `excludedMenus`에 포함된 메뉴는 LLM 응답에 들어가도 호출자가 거부한다
  - [x] 메뉴 카드에 "조건 다시 입력" 버튼이 존재하고 클릭 시 결과가 숨겨지고 입력 폼이 다시 표시된다
  - [x] **위치 데이터 처리 코드 리뷰**: `services/menu-decider-service.ts`가 데이터베이스 클라이언트 또는 외부 저장소 쓰기 라이브러리(`fs/promises` `writeFile`, Redis, Prisma, KV 등)를 import하지 않는다 (Task 종료 시 grep으로 확인 + PR 체크)
- **검증**:
  - `bun run test app/page.test.tsx services/menu-decider-service.test.ts`
  - `bun run build`
  - Grep 체크: `grep -E "(prisma|drizzle|kysely|writeFile|redis|@vercel/kv)" services/menu-decider-service.ts` → 매치 없음

---

### Task 2: 위치 + 날씨 + 시간대 자동 수집

- **담당 시나리오**: Scenario 1 (자동 수집 영역), Scenario 2 (자동 수집 영역 + 한 줄 이유의 단서 검증)
- **크기**: M (5 파일)
- **의존성**: Task 1
- **참조**:
  - `vercel-react-best-practices` — `use client` 경계 최소화
  - `next-best-practices` — 동적 import 패턴
  - Open-Meteo API — `https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lng}&current=temperature_2m,weather_code` (키 없음)
- **구현 대상**:
  - `lib/time-of-day.ts` (현재 시각 → 아침/점심/저녁/야식 매핑, 임계값 명시: 06-10 아침, 11-14 점심, 17-21 저녁, 22-03 야식, 그 외는 가장 가까운 것)
  - `lib/weather.ts` + `*.test.ts` (Open-Meteo 응답 → `{ condition: "맑음"|"흐림"|"비"|..., tempC: number }` 매핑, fetch 주입 가능)
  - `hooks/use-geolocation.ts` (`navigator.geolocation.getCurrentPosition`, 권한 상태 + 좌표 반환)
  - `components/menu-decider/context-display.tsx` (위치 라벨 + 날씨 + 시간대 표시)
  - `app/page.tsx` 업데이트 (hardcoded → 실제 hook + weather fetch + time util)
- **수용 기준**:
  - [x] 위치 권한 허용 → 자동 수집 카드에 좌표 기반 날씨 텍스트(예: "흐림 18°C")가 표시된다
  - [x] 자동 수집 카드에 현재 시각 기준 시간대 텍스트("점심" 등)가 표시된다 (`page.test.tsx`에서 `Date` mock으로 13:00 설정 → "점심" DOM 단언으로 외부 관찰)
  - [x] Open-Meteo 응답 도착 전에는 자동 수집 영역에 로딩 표시가 보인다
  - [x] 빈 프롬프트 + 위치 허용 + "추천받기" → 메뉴 카드의 한 줄 이유 텍스트에 현재 날씨 단서(예: "비", "흐림", "맑음", "쌀쌀한", "더운") **또는** 시간대 단서(예: "아침", "점심", "저녁", "야식")가 최소 하나 포함된다 (`page.test.tsx`에서 mock LLM 응답이 단서를 포함하는지 정규식으로 단언, 통합 테스트 fixture로 검증)
- **검증**:
  - `bun run test lib/weather.test.ts app/page.test.tsx`
  - Browser MCP — 페이지 열고 위치 권한 허용 → 자동 수집 카드 텍스트 확인, 증거 `artifacts/menu-decider/evidence/task-2-context.png`

---

### Task 3: LLM 실패 에러 처리 + "다시 시도"

- **담당 시나리오**: Scenario 6 (LLM 실패)
- **크기**: S (2 파일)
- **의존성**: Task 1 (decide-menu Server Action 실패 분기)
- **참조**:
  - `shadcn` — Card, Button
  - `web-design-guidelines` — 에러 메시지 톤, `role="alert"` 접근성
- **구현 대상**:
  - `components/menu-decider/recommendation-error.tsx` ("추천을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요" + "다시 시도" 버튼 + "이전에 입력한 조건은 그대로 유지됩니다" 안내)
  - `app/page.tsx` 업데이트 (decide-menu Server Action 실패 catch → recommendation-error 표시, 성공 시 메뉴 카드 표시)
- **수용 기준**:
  - [x] decide-menu Server Action이 throw → "추천을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요" + "다시 시도" 버튼 표시
  - [x] 실패 상태에서 메뉴 카드 영역은 표시되지 않는다
  - [x] "다시 시도" 클릭 → 이전 입력값(프롬프트, 위치)이 유지된 채로 decide-menu가 재호출된다 (mock이 두 번 호출되고 두 번째 호출의 인자가 첫 번째와 같음을 외부적으로 단언 — 그 결과 카드가 표시되는 것으로 검증)
- **검증**:
  - `bun run test app/page.test.tsx components/menu-decider/recommendation-error.test.tsx`

---

### Checkpoint: Tasks 1-3 이후 (메뉴 결정 vertical slice + 실패 경로)
- [ ] 모든 테스트 통과: `bun run test`
- [ ] 빌드 성공: `bun run build`
- [ ] 페이지 진입 → 위치 권한 허용 → 추천받기 → **3초 이내** 메뉴 카드 / LLM 실패 시 에러 + 재시도 (Scenario 1·2 메뉴 부분 + Scenario 6 end-to-end)

---

### Task 4: 카카오 로컬 API 식당 검색 + 식당 카드 (추정 메뉴는 hardcoded mock) + 스켈레톤

- **담당 시나리오**: Scenario 1 (식당 카드 영역, 추정 메뉴 제외), 불변규칙 "결과 순서"
- **크기**: M (5 파일)
- **의존성**: Task 1 (메뉴 카드 표시 후)
- **참조**:
  - 카카오 로컬 API — `GET https://dapi.kakao.com/v2/local/search/keyword.json?query={메뉴명}&x={lng}&y={lat}&radius=1000&size=3` (`Authorization: KakaoAK {REST_KEY}` 헤더)
  - `shadcn` — Card
  - `artifacts/menu-decider/wireframe.html` — 결과 화면 scenario-loading 변종 스켈레톤
- **구현 대상**:
  - `.env.example` 업데이트 (`KAKAO_REST_API_KEY=`)
  - `services/kakao-local-service.ts` + `*.test.ts` (fetch 모킹, 응답 매핑, 0개/실패는 빈 배열 반환)
  - `app/actions/search-restaurants.ts` (Server Action, `{ menu, coords }` → `Restaurant[]` 최대 3개)
  - `components/menu-decider/restaurant-card.tsx` (식당명·도보 거리·카테고리·카카오맵 외부 링크, 메뉴 리스트 placeholder)
  - `components/menu-decider/restaurant-skeleton.tsx` (shimmer 스켈레톤 카드 3개)
  - `app/page.tsx` 업데이트 (메뉴 카드 도착 → search-restaurants 호출 시 스켈레톤 3개 표시 → 응답 도착 시 카드로 교체)
- **수용 기준**:
  - [x] 메뉴 카드 도착 후 식당 영역에 스켈레톤(shimmer) 카드 3개가 표시된다
  - [x] search-restaurants 응답 도착 → 스켈레톤이 실제 식당 카드 3개로 교체된다
  - [x] 메뉴 카드가 식당 카드(또는 스켈레톤이 실제 카드로 교체되는 시점)보다 먼저 화면에 나타난다
  - [x] 각 식당 카드에 식당명, 도보 거리, 카카오맵 상세 외부 링크가 표시된다
  - [x] 외부 링크 `href`가 `place_url` 형태이고 `target="_blank"`로 새 탭에서 열린다
- **검증**:
  - `bun run test services/kakao-local-service.test.ts app/page.test.tsx`
  - Browser MCP — 메뉴 카드 → 스켈레톤 → 식당 카드 시각 순서, 증거 `artifacts/menu-decider/evidence/task-4-order.png`

---

### Task 5: 식당별 추정 메뉴 LLM (2차 호출) + disclaimer

- **담당 시나리오**: Scenario 1 (식당 카드의 추정 메뉴/가격), 불변규칙 "Hallucination 투명성"
- **크기**: S (3 파일)
- **의존성**: Task 4
- **참조**:
  - `claude-api` — 2차 LLM 호출, 식당 리스트 한 번에 처리 (호출 비용 ↓), structured output (JSON)
- **구현 대상**:
  - `services/restaurant-menu-estimator-service.ts` + `*.test.ts` (입력: `{ menu, restaurants: Restaurant[] }` → 출력: `EstimatedRestaurantMenu[]`)
  - `app/actions/estimate-menus.ts` (Server Action)
  - `components/menu-decider/restaurant-card.tsx` 업데이트 (placeholder → 진짜 추정 메뉴 1-3개 + 가격 + disclaimer 영구 표시)
- **수용 기준**:
  - [x] 식당 카드의 추정 메뉴 1-3개가 메뉴명과 가격(예: "9,000원") 형식으로 표시된다
  - [x] 모든 식당 카드 하단에 "메뉴·가격은 AI 추정값입니다. 실제는 가게에서 확인해 주세요" 텍스트가 표시되고 DOM에 영구 노드로 존재 (닫기 버튼 없음)
- **검증**:
  - `bun run test services/restaurant-menu-estimator-service.test.ts`
  - `bun run test components/menu-decider/restaurant-card.test.tsx` (disclaimer DOM 존재 단언)

---

### Task 6: 카카오맵 JS SDK 지도 컴포넌트

- **담당 시나리오**: Scenario 1 (지도 + 핀 3개)
- **크기**: S (2 파일)
- **의존성**: Task 4
- **참조**:
  - 카카오맵 JS SDK — `https://dapi.kakao.com/v2/maps/sdk.js?appkey={KEY}&autoload=false`
  - `next-best-practices` — `next/dynamic` + `ssr: false`
- **구현 대상**:
  - `.env.example` 업데이트 (`NEXT_PUBLIC_KAKAO_JS_KEY=`)
  - `components/menu-decider/restaurant-map.tsx` (dynamic import only, no SSR, props: `restaurants: Restaurant[]` → 핀 3개 + 라벨 1/2/3)
  - `app/page.tsx` 업데이트 (식당 카드 영역 옆 지도)
- **수용 기준**:
  - [x] 결과 화면에 카카오맵이 렌더되고 식당 좌표 3곳에 마커(번호 1/2/3)가 표시된다
  - [x] 데스크톱 viewport에서 지도가 식당 카드 우측에 위치한다 (`@md:` grid 사용)
  - [x] 모바일 viewport에서 지도가 식당 카드 아래에 위치한다
- **검증**:
  - `bun run build`
  - Browser MCP — Desktop·Mobile viewport 레이아웃, 증거 `artifacts/menu-decider/evidence/task-6-map-{desktop,mobile}.png`

---

### Checkpoint: Tasks 4-6 이후 (정상 흐름 완성)
- [ ] 모든 테스트 통과: `bun run test`
- [ ] 빌드 성공: `bun run build`
- [ ] Scenario 1, Scenario 2가 end-to-end로 동작: 입력 → 메뉴 카드 → 식당 카드 3개 + 지도

---

### Task 7: 위치 권한 거부 fallback (수동 지역 입력)

- **담당 시나리오**: Scenario 3, 불변규칙 "위치 데이터 처리"
- **크기**: M (4 파일)
- **의존성**: Task 2 (Geolocation hook의 거부 분기)
- **참조**:
  - 카카오 로컬 주소 검색 API — `GET https://dapi.kakao.com/v2/local/search/address.json?query={지역명}`
  - `shadcn` — Input, Label
- **구현 대상**:
  - `services/kakao-geocoding-service.ts` + `*.test.ts` (지역명 → 좌표, 인식 불가 시 명시적 에러 타입)
  - `app/actions/resolve-region.ts` (Server Action)
  - `components/menu-decider/region-input.tsx` (입력 칸 + 안내 + 에러)
  - `app/page.tsx` 업데이트 (Geolocation 거부 → region-input 노출)
- **수용 기준**:
  - [x] 위치 권한 거부 상태에서 "위치 정보를 사용할 수 없어요. 지역을 입력해 주세요" 안내와 지역 입력 칸이 표시된다
  - [x] "강남역" 입력 + "추천받기" → 강남역 좌표 기반으로 메뉴 카드 + 식당 Top3가 표시된다
  - [x] 인식 불가한 지역명 입력 + "추천받기" → 입력 칸 아래 "지역을 찾을 수 없습니다. 다시 입력해 주세요" 메시지가 표시된다
  - [x] **위치 데이터 처리 코드 리뷰**: `services/kakao-geocoding-service.ts`가 데이터베이스 클라이언트/외부 저장소 쓰기 라이브러리를 import하지 않는다 (grep으로 확인)
- **검증**:
  - `bun run test services/kakao-geocoding-service.test.ts app/page.test.tsx`
  - Grep 체크: `grep -E "(prisma|drizzle|kysely|writeFile|redis|@vercel/kv)" services/kakao-geocoding-service.ts` → 매치 없음

---

### Task 8: "다시 추천" — 같은 세션 이전 메뉴 제외 + "새로 추천됨" 배지

- **담당 시나리오**: Scenario 5
- **크기**: S (2 파일)
- **의존성**: Task 1
- **참조**:
  - `vercel-react-best-practices` — 클라이언트 상태로 viewed 추적, re-render 최소화
  - `shadcn` — Badge
- **구현 대상**:
  - `app/page.tsx` 업데이트 (클라이언트 `viewedMenus: string[]` 상태, "다시 추천" 클릭 → 같은 컨텍스트 + `excludedMenus`로 재호출)
  - `components/menu-decider/menu-card.tsx` 업데이트 ("다시 추천" 버튼, 두 번째 이후 카드부터 "새로 추천됨" 배지 + "이번 세션에서 본 메뉴: ..." 표시)
- **수용 기준**:
  - [x] 메뉴 카드 표시 후 "다시 추천" 클릭 → 3초 이내 다른 메뉴명의 카드로 교체된다 (`waitFor(..., { timeout: 3000 })`)
  - [x] 새 메뉴 카드의 메뉴명이 같은 세션에서 이미 표시되었던 메뉴명과 다르다 (mock이 두 번 호출되고 두 번째에 다른 메뉴 반환 → DOM 텍스트 변경 단언)
  - [x] 두 번째 이후 메뉴 카드 상단에 "새로 추천됨" 배지가 표시된다
  - [x] 두 번째 이후 메뉴 카드 하단에 "이번 세션에서 본 메뉴" + 이전 메뉴명들이 취소선과 함께 표시된다
- **검증**:
  - `bun run test app/page.test.tsx components/menu-decider/menu-card.test.tsx`

---

### Task 9: 식당 없음 fallback — 외부 링크

- **담당 시나리오**: Scenario 4
- **크기**: S (2 파일)
- **의존성**: Task 4
- **참조**:
  - `shadcn` — Card, Button
  - `web-design-guidelines` — 빈 상태 UX
- **구현 대상**:
  - `components/menu-decider/restaurant-empty.tsx` ("근처 식당을 찾지 못했습니다" + `https://map.kakao.com/?q={메뉴명}` 외부 링크)
  - `app/page.tsx` 업데이트 (search-restaurants가 0개 또는 실패 → restaurant-empty 표시, 지도 숨김)
- **수용 기준**:
  - [ ] search-restaurants가 빈 배열을 반환 → 메뉴 카드는 유지, 식당 영역만 restaurant-empty로 교체
  - [ ] search-restaurants가 throw → 메뉴 카드는 유지, 식당 영역만 restaurant-empty로 교체
  - [ ] restaurant-empty 외부 링크 `href`가 `https://map.kakao.com/?q={메뉴명}` 형태이며 `target="_blank"`
  - [ ] restaurant-empty 상태에서 지도 컴포넌트는 렌더되지 않는다
- **검증**:
  - `bun run test app/page.test.tsx components/menu-decider/restaurant-empty.test.tsx`

---

### Checkpoint: Tasks 7-9 이후 (모든 시나리오 + 불변규칙)
- [ ] 모든 테스트 통과: `bun run test`
- [ ] 빌드 성공: `bun run build`
- [ ] Scenario 1-6 + 모든 불변규칙이 단위·통합 레벨에서 검증됨

---

### Task 10: E2E 시나리오 검증 (Playwright)

- **담당 시나리오**: Scenario 1, 3, 5, 6 (실 브라우저에서 반복 가능한 경계 검증)
- **크기**: S (1-2 파일)
- **의존성**: Tasks 1-9
- **참조**:
  - `playwright.config.ts` — 기존 설정
  - `e2e/smoke.spec.ts` — 기존 패턴
  - Playwright `page.route()` — 외부 API 모킹
- **구현 대상**:
  - `e2e/menu-decider.spec.ts` — Scenario 1/3/5/6 각 1 케이스
  - (선택) `e2e/fixtures/mocks.ts` — 공통 mock 응답
- **수용 기준**:
  - [ ] Scenario 1: 위치 허용 mock + 프롬프트 입력 → 메뉴 카드 + 식당 카드 3개가 DOM에 나타남
  - [ ] Scenario 3: Geolocation 거부 시뮬레이션 → 지역 입력 칸 표시 후 "강남역" 입력 → 메뉴 카드 표시
  - [ ] Scenario 5: 메뉴 카드 표시 → "다시 추천" 클릭 → 다른 메뉴명 표시
  - [ ] Scenario 6: Anthropic API 응답을 500으로 mock → 에러 메시지 + "다시 시도" 버튼 표시
- **검증**:
  - `bun run test:e2e`

---

## 미결정 항목

- **Anthropic 모델 선택** — `claude-haiku-4-5` (응답 빠름, 비용 ↓) vs `claude-sonnet-4-6`. Task 1 첫 측정 후 결정 (불변규칙 응답 시간 3초 충족 기준)
- **식당 검색 반경** — 카카오 로컬 API `radius` 파라미터 기본값. Task 4에서 1000m(=도보 약 13분)로 시작, 도보 거리 표시가 자연스럽지 않으면 조정
- **메뉴 풀 큐레이션 분포** — Task 1에서 ~150개 정의 시 카테고리(한식/중식/일식/양식/분식/면/찌개/구이/국밥/해산물/디저트 등) 비율. 첫 정의 후 본인 테스트로 다양성 부족 시 보강
- **식당 카드/지도 표시 인내선 정량** — spec.md 미결정. Checkpoint 1 측정 후 결정
