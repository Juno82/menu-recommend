"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Props = {
  onRetry: () => void;
  isRetrying?: boolean;
};

export function RecommendationError({ onRetry, isRetrying }: Props) {
  return (
    <Card className="mx-auto max-w-2xl ring-2 ring-foreground/40" role="alert">
      <CardContent className="p-8 text-center">
        <AlertTriangle className="mx-auto mb-4 size-12" />
        <p className="mb-2 text-base font-bold">추천을 불러오지 못했습니다</p>
        <p className="mb-6 text-sm text-muted-foreground">잠시 후 다시 시도해 주세요</p>
        <Button onClick={onRetry} disabled={isRetrying} className="mx-auto">
          <RefreshCw className="size-4" />
          {isRetrying ? "재시도 중..." : "다시 시도"}
        </Button>
        <p className="mt-4 text-xs text-muted-foreground">
          이전에 입력한 조건은 그대로 유지됩니다
        </p>
      </CardContent>
    </Card>
  );
}
