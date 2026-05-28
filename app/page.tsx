"use client";

import { Sparkles } from "lucide-react";
import { useCallback, useEffect, useState, useTransition } from "react";
import { decideMenuAction } from "@/app/actions/decide-menu";
import { estimateMenusAction } from "@/app/actions/estimate-menus";
import { resolveRegionAction } from "@/app/actions/resolve-region";
import { searchRestaurantsAction } from "@/app/actions/search-restaurants";
import { ContextDisplay } from "@/components/menu-decider/context-display";
import { MenuCard } from "@/components/menu-decider/menu-card";
import { RecommendationError } from "@/components/menu-decider/recommendation-error";
import { RegionInput } from "@/components/menu-decider/region-input";
import { RestaurantCard } from "@/components/menu-decider/restaurant-card";
import { RestaurantMap } from "@/components/menu-decider/restaurant-map";
import { RestaurantSkeletonList } from "@/components/menu-decider/restaurant-skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useGeolocation } from "@/hooks/use-geolocation";
import { getTimeOfDay } from "@/lib/time-of-day";
import { fetchWeather } from "@/lib/weather";
import type { ResolvedRegion } from "@/services/kakao-geocoding-service";
import type {
  Coords,
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
  const [viewedMenus, setViewedMenus] = useState<string[]>([]);

  const geo = useGeolocation();
  const [resolvedRegion, setResolvedRegion] = useState<ResolvedRegion | null>(null);
  const [regionResolveError, setRegionResolveError] = useState<string | null>(null);
  const [isResolvingRegion, setIsResolvingRegion] = useState(false);

  const [weather, setWeather] = useState<Weather | undefined>(undefined);
  const timeOfDay = getTimeOfDay();

  // 활성 좌표/지역 라벨 — geo 허용이면 hook, 거부면 사용자가 resolve한 지역
  const activeCoords: Coords | null =
    geo.status === "granted"
      ? geo.coords
      : resolvedRegion
        ? resolvedRegion.coords
        : null;
  const activeRegionLabel: string | null =
    geo.status === "granted"
      ? "현재 위치"
      : resolvedRegion
        ? resolvedRegion.label
        : null;

  // 좌표 결정되면 날씨 fetch
  useEffect(() => {
    if (!activeCoords) return;
    let cancelled = false;
    setWeather(undefined);
    fetchWeather(activeCoords)
      .then((w) => {
        if (!cancelled) setWeather(w);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [activeCoords]);

  // 메뉴 결정 도착 → 식당 검색
  useEffect(() => {
    if (!recommendation || !activeCoords) return;
    let cancelled = false;
    setRestaurants(null);
    setEstimatedMenus({});
    setIsSearchingRestaurants(true);
    searchRestaurantsAction(recommendation.menu, activeCoords)
      .then((result) => {
        if (!cancelled) setRestaurants(result);
      })
      .catch(() => {
        if (!cancelled) setRestaurants([]);
      })
      .finally(() => {
        if (!cancelled) setIsSearchingRestaurants(false);
      });
    return () => {
      cancelled = true;
    };
  }, [recommendation, activeCoords]);

  // 식당 도착 → 추정 메뉴 (2차 LLM)
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
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [recommendation, restaurants]);

  const canSubmit = activeCoords !== null && weather !== undefined && !isPending;

  const requestRecommendation = useCallback(() => {
    if (!activeCoords || !activeRegionLabel || !weather) return;
    setDecideError(null);
    setRestaurants(null);
    startTransition(async () => {
      const context: RecommendationContext = {
        coords: activeCoords,
        regionLabel: activeRegionLabel,
        weather,
        timeOfDay,
        prompt: prompt.trim() ? prompt.trim() : undefined,
        excludedMenus: viewedMenus,
      };
      try {
        const result = await decideMenuAction(context);
        setRecommendation(result);
        setViewedMenus((prev) => (prev.includes(result.menu) ? prev : [...prev, result.menu]));
      } catch (err) {
        setDecideError(err instanceof Error ? err : new Error(String(err)));
        setRecommendation(null);
      }
    });
  }, [activeCoords, activeRegionLabel, weather, timeOfDay, prompt, viewedMenus]);

  const reset = () => {
    setRecommendation(null);
    setDecideError(null);
    setRestaurants(null);
    setEstimatedMenus({});
    setViewedMenus([]);
  };

  const submitRegion = (regionName: string) => {
    setIsResolvingRegion(true);
    setRegionResolveError(null);
    void resolveRegionAction(regionName)
      .then((result) => {
        if (result.ok) {
          setResolvedRegion(result.region);
        } else if (result.reason === "not_found") {
          setRegionResolveError("지역을 찾을 수 없습니다. 다시 입력해 주세요");
        } else {
          setRegionResolveError("지역 검색에 실패했습니다. 잠시 후 다시 시도해 주세요");
        }
      })
      .finally(() => setIsResolvingRegion(false));
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
            viewedMenus={viewedMenus}
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
                {activeCoords && (
                  <div className="md:sticky md:top-6">
                    <RestaurantMap restaurants={restaurants} center={activeCoords} />
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </section>
      </main>
    );
  }

  const locationDenied = geo.status === "denied" || geo.status === "unsupported";

  return (
    <main className="mx-auto min-h-screen max-w-2xl p-6">
      <div className="my-8 text-center">
        <h1 className="text-2xl font-bold">오늘 뭐 먹지?</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          버튼 하나로 메뉴 1개를 결정해 드립니다
        </p>
      </div>

      {locationDenied ? (
        <RegionInput
          isSubmitting={isResolvingRegion}
          errorMessage={regionResolveError ?? undefined}
          resolvedLabel={resolvedRegion?.label}
          onSubmit={submitRegion}
        />
      ) : null}

      <ContextDisplay
        regionLabel={activeRegionLabel ?? undefined}
        weather={weather}
        timeOfDay={timeOfDay}
        locationStatus={
          geo.status === "granted"
            ? "granted"
            : resolvedRegion
              ? "granted"
              : geo.status
        }
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
    </main>
  );
}
