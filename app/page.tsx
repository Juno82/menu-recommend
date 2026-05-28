"use client";

import { Sparkles } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { decideMenuAction } from "@/app/actions/decide-menu";
import { ContextDisplay } from "@/components/menu-decider/context-display";
import { MenuCard } from "@/components/menu-decider/menu-card";
import { RecommendationError } from "@/components/menu-decider/recommendation-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useGeolocation } from "@/hooks/use-geolocation";
import { getTimeOfDay } from "@/lib/time-of-day";
import { fetchWeather } from "@/lib/weather";
import type { MenuRecommendation, RecommendationContext, Weather } from "@/types/menu-decider";

export default function Page() {
  const [prompt, setPrompt] = useState("");
  const [recommendation, setRecommendation] = useState<MenuRecommendation | null>(null);
  const [decideError, setDecideError] = useState<Error | null>(null);
  const [isPending, startTransition] = useTransition();

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
        // Task 3에서 통일 에러 처리. 여기서는 weather 미설정 상태로 둠
      });
    return () => {
      cancelled = true;
    };
  }, [geo]);

  const canSubmit = geo.status === "granted" && weather !== undefined && !isPending;

  const requestRecommendation = () => {
    if (geo.status !== "granted" || !weather) return;
    setDecideError(null);
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
  };

  const reset = () => {
    setRecommendation(null);
    setDecideError(null);
  };

  return (
    <main className="mx-auto min-h-screen max-w-2xl p-6">
      {decideError ? (
        <RecommendationError onRetry={requestRecommendation} isRetrying={isPending} />
      ) : recommendation ? (
        <MenuCard
          recommendation={recommendation}
          isRetrying={isPending}
          onRetry={requestRecommendation}
          onReset={reset}
        />
      ) : (
        <>
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
        </>
      )}
    </main>
  );
}
