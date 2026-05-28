"use client";

import { ExternalLink, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Props = {
  menuName: string;
  /** 카카오맵 외부 검색에 쓸 키워드. 미제공 시 menuName 사용. */
  searchQuery?: string;
};

export function RestaurantEmpty({ menuName, searchQuery }: Props) {
  const effectiveQuery = searchQuery ?? menuName;
  const url = `https://map.kakao.com/?q=${encodeURIComponent(effectiveQuery)}`;
  return (
    <Card className="mx-auto max-w-2xl">
      <CardContent className="p-6 text-center">
        <SearchX className="mx-auto mb-3 size-8 text-muted-foreground" />
        <p className="mb-2 text-sm">
          근처에서 {menuName} 식당을 찾지 못했습니다
        </p>
        <p className="mb-4 text-xs text-muted-foreground">
          카카오맵에서 직접 검색해 보세요
        </p>
        <Button asChild>
          <a href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="size-4" />
            카카오맵에서 &quot;{effectiveQuery}&quot; 검색
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
