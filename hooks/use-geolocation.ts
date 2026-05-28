"use client";

import { useEffect, useState } from "react";
import type { Coords } from "@/types/menu-decider";

export type GeolocationState =
  | { status: "pending" }
  | { status: "granted"; coords: Coords }
  | { status: "denied"; message?: string }
  | { status: "unsupported" };

export function useGeolocation(): GeolocationState {
  const [state, setState] = useState<GeolocationState>({ status: "pending" });

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState({ status: "unsupported" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setState({
          status: "granted",
          coords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
        });
      },
      (err) => {
        setState({ status: "denied", message: err.message });
      },
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 10_000 },
    );
  }, []);

  return state;
}
