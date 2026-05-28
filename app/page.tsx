"use client";

import { Clock, CloudRain, MapPin, Sparkles } from "lucide-react";
import { useState, useTransition } from "react";
import { decideMenuAction } from "@/app/actions/decide-menu";
import { MenuCard } from "@/components/menu-decider/menu-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MenuRecommendation, RecommendationContext } from "@/types/menu-decider";

// Task 2에서 hook으로 교체됩니다.
const MOCK_CONTEXT_BASE = {
  coords: { lat: 37.4979, lng: 127.0276 },
  regionLabel: "서울 강남구",
  weather: { condition: "흐림", tempC: 18 },
  timeOfDay: "점심",
} as const;

export default function Page() {
  const [prompt, setPrompt] = useState("");
  const [recommendation, setRecommendation] = useState<MenuRecommendation | null>(null);
  const [isPending, startTransition] = useTransition();

  const requestRecommendation = () => {
    startTransition(async () => {
      const context: RecommendationContext = {
        coords: MOCK_CONTEXT_BASE.coords,
        regionLabel: MOCK_CONTEXT_BASE.regionLabel,
        weather: MOCK_CONTEXT_BASE.weather,
        timeOfDay: MOCK_CONTEXT_BASE.timeOfDay,
        prompt: prompt.trim() ? prompt.trim() : undefined,
        excludedMenus: [],
      };
      const result = await decideMenuAction(context);
      setRecommendation(result);
    });
  };

  const reset = () => setRecommendation(null);

  return (
    <main className="mx-auto min-h-screen max-w-2xl p-6">
      {recommendation ? (
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

          <Card size="sm" className="mb-4">
            <CardContent>
              <div className="mb-2 text-xs text-muted-foreground">자동 수집된 맥락</div>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <div className="flex items-center gap-1">
                  <MapPin className="size-4" />
                  <span>{MOCK_CONTEXT_BASE.regionLabel}</span>
                </div>
                <span className="text-muted-foreground">·</span>
                <div className="flex items-center gap-1">
                  <CloudRain className="size-4" />
                  <span>
                    {MOCK_CONTEXT_BASE.weather.condition} {MOCK_CONTEXT_BASE.weather.tempC}°C
                  </span>
                </div>
                <span className="text-muted-foreground">·</span>
                <div className="flex items-center gap-1">
                  <Clock className="size-4" />
                  <span>{MOCK_CONTEXT_BASE.timeOfDay}</span>
                </div>
              </div>
            </CardContent>
          </Card>

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
            disabled={isPending}
            className="w-full py-6 text-base font-bold"
          >
            <Sparkles className="size-4" />
            {isPending ? "추천하는 중..." : "추천받기"}
          </Button>
        </>
      )}
    </main>
  );
}
