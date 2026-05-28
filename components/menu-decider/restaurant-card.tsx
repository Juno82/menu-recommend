"use client";

import { ExternalLink, Footprints, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatWalkingDistance } from "@/services/kakao-local-service";
import type { EstimatedRestaurantMenu, Restaurant } from "@/types/menu-decider";

const DISCLAIMER = "메뉴·가격은 AI 추정값입니다. 실제는 가게에서 확인해 주세요.";

type Props = {
  restaurant: Restaurant;
  pinNumber: number;
  estimatedMenu?: EstimatedRestaurantMenu;
};

export function RestaurantCard({ restaurant, pinNumber, estimatedMenu }: Props) {
  return (
    <Card size="sm">
      <CardContent>
        <div className="mb-1 flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Pin number={pinNumber} />
            <div className="text-base font-bold">{restaurant.name}</div>
          </div>
          <div className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
            <Footprints className="size-3" />
            {formatWalkingDistance(restaurant.distanceMeters)}
          </div>
        </div>

        <div className="mb-3 pl-8 text-xs text-muted-foreground">
          {restaurant.categoryName}
        </div>

        {estimatedMenu && estimatedMenu.items.length > 0 ? (
          <ul className="mb-3 space-y-0 pl-8 text-sm">
            {estimatedMenu.items.map((item) => (
              <li
                key={item.name}
                className="flex justify-between border-b py-1.5 last:border-b-0"
              >
                <span>{item.name}</span>
                <span className="text-muted-foreground">{item.priceWon}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mb-3 pl-8 text-xs italic text-muted-foreground">
            추정 메뉴 로딩 중...
          </div>
        )}

        <a
          href={restaurant.kakaoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-8 inline-flex items-center gap-1 text-xs underline-offset-2 hover:underline"
        >
          <ExternalLink className="size-3" />
          카카오맵에서 보기
        </a>

        <div className="mt-3 flex items-start gap-1 border-t pl-8 pt-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3 shrink-0" />
          <span>{DISCLAIMER}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function Pin({ number }: { number: number }) {
  return (
    <div className="inline-flex size-6 items-center justify-center rounded-full border-2 border-foreground/60 text-xs font-bold">
      {number}
    </div>
  );
}
