"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import type { DecideMenuFailureReason } from "@/app/actions/decide-menu";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Props = {
  onRetry: () => void;
  isRetrying?: boolean;
  errorType?: DecideMenuFailureReason;
  retryAfterSeconds?: number;
};

type Message = { title: string; detail: string };

function messageFor(
  errorType: DecideMenuFailureReason | undefined,
  retryAfterSeconds: number | undefined,
): Message {
  if (errorType === "rate_limit") {
    const detail =
      retryAfterSeconds !== undefined
        ? `Gemini 일일 사용량 한도에 도달했습니다. 약 ${Math.ceil(retryAfterSeconds)}초 뒤 다시 시도해 주세요`
        : "Gemini 일일 사용량 한도에 도달했습니다. 잠시 후 다시 시도해 주세요";
    return { title: "지금은 추천이 어려워요", detail };
  }
  if (errorType === "unavailable") {
    return {
      title: "Gemini가 일시적으로 혼잡합니다",
      detail: "잠시 후 다시 시도해 주세요",
    };
  }
  return {
    title: "추천을 불러오지 못했습니다",
    detail: "잠시 후 다시 시도해 주세요",
  };
}

export function RecommendationError({
  onRetry,
  isRetrying,
  errorType,
  retryAfterSeconds,
}: Props) {
  const { title, detail } = messageFor(errorType, retryAfterSeconds);
  return (
    <Card className="mx-auto max-w-2xl ring-2 ring-foreground/40" role="alert">
      <CardContent className="p-8 text-center">
        <AlertTriangle className="mx-auto mb-4 size-12" />
        <p className="mb-2 text-base font-bold">{title}</p>
        <p className="mb-6 text-sm text-muted-foreground">{detail}</p>
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
