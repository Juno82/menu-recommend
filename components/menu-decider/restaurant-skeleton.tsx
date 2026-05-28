"use client";

import { Card, CardContent } from "@/components/ui/card";

export function RestaurantSkeleton() {
  return (
    <Card size="sm" aria-hidden="true">
      <CardContent>
        <div className="mb-2 h-5 w-2/3 animate-pulse rounded bg-muted" />
        <div className="mb-3 h-3 w-1/3 animate-pulse rounded bg-muted" />
        <div className="mb-2 h-4 w-full animate-pulse rounded bg-muted" />
        <div className="mb-2 h-4 w-5/6 animate-pulse rounded bg-muted" />
        <div className="h-4 w-4/6 animate-pulse rounded bg-muted" />
      </CardContent>
    </Card>
  );
}

export function RestaurantSkeletonList() {
  return (
    <div className="space-y-3" data-testid="restaurant-skeleton-list">
      <RestaurantSkeleton />
      <RestaurantSkeleton />
      <RestaurantSkeleton />
    </div>
  );
}
