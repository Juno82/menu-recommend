"use client";

import { Sparkles } from "lucide-react";
import { useCallback, useEffect, useState, useTransition } from "react";
import { decideMenuAction } from "@/app/actions/decide-menu";
import { estimateMenusAction } from "@/app/actions/estimate-menus";
import { searchRestaurantsAction } from "@/app/actions/search-restaurants";
import { ContextDisplay } from "@/components/menu-decider/context-display";
import { MenuCard } from "@/components/menu-decider/menu-card";
import { RecommendationError } from "@/components/menu-decider/recommendation-error";
import { RestaurantCard } from "@/components/menu-decider/restaurant-card";
import { RestaurantMap } from "@/components/menu-decider/restaurant-map";
import { RestaurantSkeletonList } from "@/components/menu-decider/restaurant-skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useGeolocation } from "@/hooks/use-geolocation";
import { getTimeOfDay } from "@/lib/time-of-day";
import { fetchWeather } from "@/lib/weather";
import type {
  EstimatedRestaurantMenu,
  MenuRecommendation,
  RecommendationContext,
  Restaurant,
  Weather,
} from "@/types/menu-decider";

export default function Page() {
  const [prompt, setPrompt] = useState("");
  const [recommendation, setRecommendation] = useState<MenuRecommendation | null>(null);
  const [decideError, setDecideError] = useState<Error | null>(null);
  const [isPending, startTransition] = useTransition();

  const [restaurants, setRestaurants] = useState<Restaurant[] | null>(null);
  const [isSearchingRestaurants, setIsSearchingRestaurants] = useState(false);
  const [estimatedMenus, setEstimatedMenus] = useState<Record<string, EstimatedRestaurantMenu>>({});

  const geo = useGeolocation();
  const [weather, setWeather] = useState<Weather | undefined>(undefined);
  const timeOfDay = getTimeOfDay();

  useEffect(() => {
    if (geo.status !== "granted") return;
    let cancelled = false;
    fetchWeather(geo.coords)
      .then((w) => {
        if (!cancelled) setWeather(w);
      })
      .catch(() => {
        // 날씨 실패는 Task 후속에서 통일 에러 처리. 지금은 weather 미설정 상태로 둠.
      });
    return () => {
      cancelled = true;
    };
  }, [geo]);

  // 메뉴 결정 도착 → 식당 검색 트리거
  useEffect(() => {
    if (!recommendation || geo.status !== "granted") return;
    let cancelled = false;
    setRestaurants(null);
    setEstimatedMenus({});
    setIsSearchingRestaurants(true);
    searchRestaurantsAction(recommendation.menu, geo.coords)
      .then((result) => {
        if (!cancelled) setRestaurants(result);
      })
      .catch(() => {
        if (!cancelled) setRestaurants([]); // Task 9의 빈 결과 fallback 경로
      })
      .finally(() => {
        if (!cancelled) setIsSearchingRestaurants(false);
      });
    return () => {
      cancelled = true;
    };
  }, [recommendation, geo]);

  // 식당 도착 → 식당별 추정 메뉴(2차 LLM) 호출
  useEffect(() => {
    if (!recommendation || !restaurants || restaurants.length === 0) return;
    let cancelled = false;
    estimateMenusAction(recommendation.menu, restaurants)
      .then((estimated) => {
        if (cancelled) return;
        const map: Record<string, EstimatedRestaurantMenu> = {};
        for (const e of estimated) map[e.restaurantId] = e;
        setEstimatedMenus(map);
      })
      .catch(() => {
        // 실패해도 식당 카드는 유지. 추정 메뉴만 "로딩 중..." 자리에 남아 disclaimer는 그대로 표시됨.
      });
    return () => {
      cancelled = true;
    };
  }, [recommendation, restaurants]);

  const canSubmit = geo.status === "granted" && weather !== undefined && !isPending;

  const requestRecommendation = useCallback(() => {
    if (geo.status !== "granted" || !weather) return;
    setDecideError(null);
    setRestaurants(null);
    startTransition(async () => {
      const context: RecommendationContext = {
        coords: geo.coords,
        regionLabel: "현재 위치",
        weather,
        timeOfDay,
        prompt: prompt.trim() ? prompt.trim() : undefined,
        excludedMenus: [],
      };
      try {
        const result = await decideMenuAction(context);
        setRecommendation(result);
      } catch (err) {
        setDecideError(err instanceof Error ? err : new Error(String(err)));
        setRecommendation(null);
      }
    });
  }, [geo, weather, timeOfDay, prompt]);

  const reset = () => {
    setRecommendation(null);
    setDecideError(null);
    setRestaurants(null);
    setEstimatedMenus({});
  };

  if (decideError) {
    return (
      <main className="mx-auto min-h-screen max-w-2xl p-6">
        <RecommendationError onRetry={requestRecommendation} isRetrying={isPending} />
      </main>
    );
  }

  if (recommendation) {
    return (
      <main className="mx-auto min-h-screen max-w-6xl p-6">
        <div className="mb-8">
          <MenuCard
            recommendation={recommendation}
            isRetrying={isPending}
            onRetry={requestRecommendation}
            onReset={reset}
          />
        </div>

        <section>
          <h3 className="mb-3 text-sm text-muted-foreground">
            근처 {recommendation.menu} 식당 Top 3
          </h3>
          {isSearchingRestaurants ? (
            <RestaurantSkeletonList />
          ) : restaurants && restaurants.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
              <div className="space-y-3 md:col-span-3">
                {restaurants.map((r, idx) => (
                  <RestaurantCard
                    key={r.id}
                    restaurant={r}
                    pinNumber={idx + 1}
                    estimatedMenu={estimatedMenus[r.id]}
                  />
                ))}
              </div>
              <div className="md:col-span-2">
                {geo.status === "granted" && (
                  <div className="md:sticky md:top-6">
                    <RestaurantMap restaurants={restaurants} center={geo.coords} />
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl p-6">
      <div className="my-8 text-center">
        <h1 className="text-2xl font-bold">오늘 뭐 먹지?</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          버튼 하나로 메뉴 1개를 결정해 드립니다
        </p>
      </div>

      <ContextDisplay
        regionLabel={geo.status === "granted" ? "현재 위치" : undefined}
        weather={weather}
        timeOfDay={timeOfDay}
        locationStatus={geo.status}
      />

      <div className="mb-6">
        <Label htmlFor="prompt" className="mb-2 text-xs text-muted-foreground">
          조건 (선택)
        </Label>
        <Input
          id="prompt"
          type="text"
          placeholder="예: 느끼한 거 빼고 / 혼밥 / 해장"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
      </div>

      <Button
        onClick={requestRecommendation}
        disabled={!canSubmit}
        className="w-full py-6 text-base font-bold"
      >
        <Sparkles className="size-4" />
        {isPending ? "추천하는 중..." : "추천받기"}
      </Button>

      {(geo.status === "denied" || geo.status === "unsupported") && (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          위치 정보를 사용할 수 없습니다 (수동 지역 입력은 Task 7에서 추가됩니다)
        </p>
      )}
    </main>
  );
}
