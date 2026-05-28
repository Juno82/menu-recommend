"use client";

import { useEffect, useRef } from "react";
import type { Coords, Restaurant } from "@/types/menu-decider";

declare global {
  interface Window {
    kakao?: KakaoNamespace;
  }
}

type KakaoLatLng = { __brand: "LatLng" };
type KakaoMap = { __brand: "Map" };

type KakaoNamespace = {
  maps: {
    load: (callback: () => void) => void;
    LatLng: new (lat: number, lng: number) => KakaoLatLng;
    Map: new (
      container: HTMLElement,
      options: { center: KakaoLatLng; level: number },
    ) => KakaoMap;
    CustomOverlay: new (options: {
      position: KakaoLatLng;
      content: string;
      map: KakaoMap;
    }) => unknown;
    LatLngBounds: new () => {
      extend: (latLng: KakaoLatLng) => void;
    };
  } & {
    [key: string]: unknown;
  };
};

const SCRIPT_ID = "kakao-maps-sdk";

function loadKakaoSdk(appkey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Kakao Maps requires a browser"));
      return;
    }
    if (window.kakao?.maps?.load) {
      resolve();
      return;
    }
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Kakao SDK load failed")), {
        once: true,
      });
      return;
    }
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appkey}&autoload=false`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Kakao SDK load failed"));
    document.head.appendChild(script);
  });
}

function buildPinHtml(label: number): string {
  return `<div style="background:white;border:2px solid #555;border-radius:50% 50% 50% 0;transform:rotate(-45deg);width:28px;height:28px;display:flex;align-items:center;justify-content:center"><span style="transform:rotate(45deg);font-weight:700;font-size:12px;color:#555">${label}</span></div>`;
}

type Props = {
  restaurants: Restaurant[];
  center: Coords;
};

export function RestaurantMap({ restaurants, center }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const appkey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
    if (!appkey || !containerRef.current) return;

    let cancelled = false;
    loadKakaoSdk(appkey)
      .then(() => {
        if (cancelled || !containerRef.current || !window.kakao) return;
        window.kakao.maps.load(() => {
          if (cancelled || !containerRef.current || !window.kakao) return;
          const { maps } = window.kakao;
          const map = new maps.Map(containerRef.current, {
            center: new maps.LatLng(center.lat, center.lng),
            level: 5,
          });
          const bounds = new maps.LatLngBounds();
          restaurants.forEach((r, idx) => {
            const latLng = new maps.LatLng(r.coords.lat, r.coords.lng);
            new maps.CustomOverlay({
              position: latLng,
              content: buildPinHtml(idx + 1),
              map,
            });
            bounds.extend(latLng);
          });
        });
      })
      .catch(() => {
        // SDK 로드 실패는 silent. 식당 카드는 그대로 정보 제공.
      });

    return () => {
      cancelled = true;
    };
  }, [restaurants, center]);

  return (
    <div
      ref={containerRef}
      data-testid="restaurant-map"
      role="img"
      aria-label="식당 위치 지도"
      className="aspect-square w-full rounded-xl border bg-muted"
    />
  );
}
