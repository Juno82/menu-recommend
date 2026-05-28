"use client";

import { ArrowLeft, History, RefreshCw, Utensils } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { MenuRecommendation } from "@/types/menu-decider";
import { MenuImage } from "./menu-image";

type Props = {
  recommendation: MenuRecommendation;
  isRetrying?: boolean;
  viewedMenus?: string[];
  onRetry?: () => void;
  onReset?: () => void;
};

export function MenuCard({
  recommendation,
  isRetrying,
  viewedMenus,
  onRetry,
  onReset,
}: Props) {
  const isReRecommendation = (viewedMenus?.length ?? 0) > 1;
  const previousMenus = (viewedMenus ?? []).filter((m) => m !== recommendation.menu);

  return (
    <Card className="mx-auto max-w-2xl ring-2 ring-foreground/40">
      <CardContent className="p-6">
        <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Utensils className="size-3" />
          <span>오늘의 메뉴</span>
          {isReRecommendation && (
            <Badge variant="secondary" className="ml-1">
              새로 추천됨
            </Badge>
          )}
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="w-32 shrink-0 sm:w-40">
            <MenuImage menu={recommendation.menu} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="mb-3 text-4xl font-bold">{recommendation.menu}</h2>
            <p className="text-sm leading-relaxed">{recommendation.reason}</p>
          </div>
        </div>

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

        {previousMenus.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <History className="size-3" />
            <span>이번 세션에서 본 메뉴:</span>
            {previousMenus.map((m, idx) => (
              <span key={m}>
                <span className="line-through">{m}</span>
                {idx < previousMenus.length - 1 && ", "}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
