import type { TimeOfDay } from "@/types/menu-decider";

/**
 * 임계값
 * - 06–10: 아침
 * - 11–14: 점심
 * - 17–21: 저녁
 * - 22–03: 야식
 * - 04–05, 15–16: 가장 가까운 쪽 (아침 / 점심)
 */
export function getTimeOfDay(now: Date = new Date()): TimeOfDay {
  const h = now.getHours();
  if (h >= 6 && h <= 10) return "아침";
  if (h >= 11 && h <= 14) return "점심";
  if (h >= 17 && h <= 21) return "저녁";
  if (h >= 22 || h <= 3) return "야식";
  if (h === 4 || h === 5) return "아침";
  return "점심";
}
