"use client";

import { Clock, Cloud, Loader2, MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { TimeOfDay, Weather } from "@/types/menu-decider";

type Props = {
  regionLabel?: string;
  weather?: Weather;
  timeOfDay: TimeOfDay;
  locationStatus: "pending" | "granted" | "denied" | "unsupported";
};

export function ContextDisplay({ regionLabel, weather, timeOfDay, locationStatus }: Props) {
  const locationReady = locationStatus === "granted" && regionLabel;
  const weatherReady = weather !== undefined;

  return (
    <Card size="sm" className="mb-4">
      <CardContent>
        <div className="mb-2 text-xs text-muted-foreground">자동 수집된 맥락</div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <div className="flex items-center gap-1">
            <MapPin className="size-4" />
            {locationReady ? (
              <span>{regionLabel}</span>
            ) : locationStatus === "denied" || locationStatus === "unsupported" ? (
              <span className="text-muted-foreground">위치 정보 없음</span>
            ) : (
              <SkeletonChip />
            )}
          </div>
          <span className="text-muted-foreground">·</span>
          <div className="flex items-center gap-1">
            {weatherReady ? <Cloud className="size-4" /> : <Loader2 className="size-4 animate-spin" />}
            {weatherReady ? (
              <span>
                {weather.condition} {weather.tempC}°C
              </span>
            ) : (
              <span className="text-muted-foreground">날씨 정보 확인 중...</span>
            )}
          </div>
          <span className="text-muted-foreground">·</span>
          <div className="flex items-center gap-1">
            <Clock className="size-4" />
            <span>{timeOfDay}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SkeletonChip() {
  return <span className="inline-block h-3 w-16 animate-pulse rounded bg-muted" />;
}
