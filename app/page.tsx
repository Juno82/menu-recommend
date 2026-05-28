"use client";

import { Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  decideMenuAction,
  type DecideMenuFailureReason,
} from "@/app/actions/decide-menu";
import { fetchRestaurantMenusAction } from "@/app/actions/fetch-restaurant-menus";
import { resolveRegionAction } from "@/app/actions/resolve-region";
import { searchRestaurantsAction } from "@/app/actions/search-restaurants";
import { ContextDisplay } from "@/components/menu-decider/context-display";
import { MenuCard } from "@/components/menu-decider/menu-card";
import { RecommendationError } from "@/components/menu-decider/recommendation-error";
import { RegionInput } from "@/components/menu-decider/region-input";
import { RestaurantCard } from "@/components/menu-decider/restaurant-card";
import { RestaurantEmpty } from "@/components/menu-decider/restaurant-empty";
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
  MenuRecommendation,
  RecommendationContext,
  Restaurant,
  RestaurantMenu,
  Weather,
} from "@/types/menu-decider";

export default function Page() {
  const [prompt, setPrompt] = useState("");
  const [recommendation, setRecommendation] = useState<MenuRecommendation | null>(null);
  const [decideError, setDecideError] = useState<{
    reason: DecideMenuFailureReason;
    retryAfterSeconds?: number;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  const [restaurants, setRestaurants] = useState<Restaurant[] | null>(null);
  const [isSearchingRestaurants, setIsSearchingRestaurants] = useState(false);
  const [restaurantMenus, setRestaurantMenus] = useState<Record<string, RestaurantMenu>>({});
  const [menusLoaded, setMenusLoaded] = useState(false);
  const [menuFetchError, setMenuFetchError] = useState(false);
  const [viewedMenus, setViewedMenus] = useState<string[]>([]);

  const geo = useGeolocation();
  const [resolvedRegion, setResolvedRegion] = useState<ResolvedRegion | null>(null);
  const [regionResolveError, setRegionResolveError] = useState<string | null>(null);
  const [isResolvingRegion, setIsResolvingRegion] = useState(false);

  const [weather, setWeather] = useState<Weather | undefined>(undefined);
  const timeOfDay = getTimeOfDay();

  // 활성 좌표/지역 라벨 — geo 허용이면 hook, 거부면 사용자가 resolve한 지역
  // useMemo로 참조 안정화 — 인라인 객체가 useEffect 재실행을 폭주시키지 않도록
  const activeCoords = useMemo<Coords | null>(() => {
    if (geo.status === "granted") return geo.coords;
    if (resolvedRegion) return resolvedRegion.coords;
    return null;
  }, [geo, resolvedRegion]);

  const activeRegionLabel = useMemo<string | null>(() => {
    if (geo.status === "granted") return "현재 위치";
    if (resolvedRegion) return resolvedRegion.label;
    return null;
  }, [geo.status, resolvedRegion]);

  // 좌표 결정되면 날씨 fetch — 실패 시 sentinel 값으로 fallback해 UI 고착 방지
  useEffect(() => {
    if (!activeCoords) return;
    let cancelled = false;
    setWeather(undefined);
    fetchWeather(activeCoords)
      .then((w) => {
        if (!cancelled) setWeather(w);
      })
      .catch(() => {
        if (!cancelled) setWeather({ condition: "정보 없음", tempC: 0 });
      });
    return () => {
      cancelled = true;
    };
  }, [activeCoords]);

  // 메뉴 결정 도착 → 식당 검색
  useEffect(() => {
    if (!recommendation || !activeCoords) return;
    let cancelled = false;
    setRestaurants(null);
    setRestaurantMenus({});
    setMenusLoaded(false);
    setIsSearchingRestaurants(true);
    searchRestaurantsAction(
      recommendation.searchQuery ?? recommendation.menu,
      activeCoords,
    )
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

  // 식당 도착 → 카카오 place에서 실제 메뉴/가격 조회
  useEffect(() => {
    if (!restaurants || restaurants.length === 0) return;
    let cancelled = false;
    setMenuFetchError(false);
    setMenusLoaded(false);
    fetchRestaurantMenusAction(restaurants)
      .then((menus) => {
        if (cancelled) return;
        const map: Record<string, RestaurantMenu> = {};
        for (const m of menus) map[m.restaurantId] = m;
        setRestaurantMenus(map);
      })
      .catch(() => {
        if (!cancelled) setMenuFetchError(true);
      })
      .finally(() => {
        if (!cancelled) setMenusLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [restaurants]);

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
        if (result.ok) {
          setRecommendation(result.recommendation);
          setViewedMenus((prev) =>
            prev.includes(result.recommendation.menu)
              ? prev
              : [...prev, result.recommendation.menu],
          );
        } else {
          setDecideError({
            reason: result.reason,
            retryAfterSeconds: result.retryAfterSeconds,
          });
          setRecommendation(null);
        }
      } catch {
        setDecideError({ reason: "unknown" });
        setRecommendation(null);
      }
    });
  }, [activeCoords, activeRegionLabel, weather, timeOfDay, prompt, viewedMenus]);

  const reset = () => {
    setRecommendation(null);
    setDecideError(null);
    setRestaurants(null);
    setRestaurantMenus({});
    setMenusLoaded(false);
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
        <RecommendationError
          onRetry={requestRecommendation}
          isRetrying={isPending}
          errorType={decideError.reason}
          retryAfterSeconds={decideError.retryAfterSeconds}
        />
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
                {menuFetchError && (
                  <p className="text-xs text-muted-foreground">
                    메뉴 정보를 가져오지 못했습니다. 가게에서 직접 확인해 주세요.
                  </p>
                )}
                {restaurants.map((r, idx) => (
                  <RestaurantCard
                    key={r.id}
                    restaurant={r}
                    pinNumber={idx + 1}
                    menu={restaurantMenus[r.id]}
                    menuLoaded={menusLoaded}
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
          ) : restaurants && restaurants.length === 0 ? (
            <RestaurantEmpty
              menuName={recommendation.menu}
              searchQuery={recommendation.searchQuery}
            />
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
