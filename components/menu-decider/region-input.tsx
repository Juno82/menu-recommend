"use client";

import { AlertCircle, MapPinOff } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Props = {
  isSubmitting?: boolean;
  errorMessage?: string;
  resolvedLabel?: string;
  onSubmit: (regionName: string) => void;
};

export function RegionInput({ isSubmitting, errorMessage, resolvedLabel, onSubmit }: Props) {
  const [value, setValue] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  };

  return (
    <Card size="sm" className="mb-4 ring-2 ring-foreground/40">
      <CardContent>
        <form onSubmit={handleSubmit}>
          <div className="mb-2 flex items-center gap-1 text-xs font-bold">
            <MapPinOff className="size-4" />
            <span>위치 정보를 사용할 수 없어요</span>
          </div>
          <div className="mb-3 text-xs text-muted-foreground">
            지역을 입력해 주세요. 입력한 지역 기준으로 날씨와 식당을 조회합니다.
          </div>
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="예: 강남역, 서교동, 부산 해운대"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={isSubmitting}
              aria-label="지역명"
            />
            <Button type="submit" disabled={!value.trim() || isSubmitting}>
              {isSubmitting ? "확인 중..." : "확인"}
            </Button>
          </div>
          {errorMessage && (
            <div className="mt-2 flex items-center gap-1 text-xs">
              <AlertCircle className="size-3" />
              <span>{errorMessage}</span>
            </div>
          )}
          {resolvedLabel && !errorMessage && (
            <div className="mt-2 text-xs text-muted-foreground">
              현재 지역: {resolvedLabel}
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
