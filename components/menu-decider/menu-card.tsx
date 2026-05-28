"use client";

import { ArrowLeft, RefreshCw, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { MenuRecommendation } from "@/types/menu-decider";

type Props = {
  recommendation: MenuRecommendation;
  isRetrying?: boolean;
  onRetry?: () => void;
  onReset?: () => void;
};

export function MenuCard({ recommendation, isRetrying, onRetry, onReset }: Props) {
  return (
    <Card className="mx-auto max-w-2xl ring-2 ring-foreground/40">
      <CardContent className="p-6">
        <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Utensils className="size-3" />
          <span>오늘의 메뉴</span>
        </div>
        <h2 className="mb-3 text-4xl font-bold">{recommendation.menu}</h2>
        <p className="text-sm leading-relaxed">{recommendation.reason}</p>

        <div className="mt-4 flex items-center justify-between border-t pt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onRetry}
            disabled={isRetrying || !onRetry}
          >
            <RefreshCw className="size-3" />
            다시 추천
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            disabled={!onReset}
          >
            <ArrowLeft className="size-3" />
            조건 다시 입력
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
