"use client";

import Image from "next/image";
import { Utensils } from "lucide-react";
import { useState } from "react";
import { getMenuImageCandidates } from "@/lib/menu-image";
import { cn } from "@/lib/utils";

type Props = {
  menu: string;
  className?: string;
};

/**
 * 메뉴 일러스트/사진 영역.
 * - public/menu-images/<menu>.<ext> (jpg/png/webp) 후보 중 첫 번째부터 시도
 * - 모두 실패하면 Utensils 아이콘 placeholder로 fallback
 * - 이미지는 1:1 비율, parent가 너비를 결정
 */
export function MenuImage({ menu, className }: Props) {
  const candidates = getMenuImageCandidates(menu);
  const [index, setIndex] = useState(0);
  const failed = index >= candidates.length;

  return (
    <div
      className={cn(
        "relative aspect-square w-full overflow-hidden rounded-lg bg-muted",
        className,
      )}
      data-testid="menu-image"
    >
      {failed ? (
        <div
          className="flex h-full w-full items-center justify-center text-muted-foreground"
          data-testid="menu-image-fallback"
          aria-label={`${menu} 이미지 없음`}
        >
          <Utensils className="size-1/3" />
        </div>
      ) : (
        <Image
          src={candidates[index]}
          alt={menu}
          fill
          sizes="(max-width: 768px) 100vw, 320px"
          className="object-cover"
          onError={() => setIndex((i) => i + 1)}
          unoptimized
        />
      )}
    </div>
  );
}
