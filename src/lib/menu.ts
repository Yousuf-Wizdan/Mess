import {
  Dish,
  MEAL_ORDER,
  MealPeriod,
  MealWindow,
  ServeStatus,
} from "@/types/menu";

function cleanDishName(name: string): string {
  return name.replace(/\s*[-–—:]+\s*$/, "").trim();
}

export function parseDishes(msNme: string): Dish[] {
  return msNme
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const match = line.match(/^(.*?)\s*\((\d+)\s*K?k?cal\)\s*$/i);
      if (!match) return { name: cleanDishName(line) };
      return { name: cleanDishName(match[1]), kcal: Number(match[2]) };
    });
}

export function parseMealName(msCde: string): string {
  return msCde.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

export function mealOrder(name: string): number {
  const idx = MEAL_ORDER.findIndex(
    (meal) =>
      name.toLowerCase() === meal.toLowerCase() ||
      name.toLowerCase().startsWith(meal.toLowerCase()),
  );
  return idx === -1 ? MEAL_ORDER.length : idx;
}

export function parseMealWindow(timeLabel: string): MealWindow | null {
  const match = timeLabel.match(
    /(\d{1,2}):(\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i,
  );
  if (!match) return null;
  const start = toMinutes(Number(match[1]), Number(match[2]), match[3]);
  const end = toMinutes(Number(match[4]), Number(match[5]), match[6]);
  if (start === null || end === null) return null;
  return { startMinutes: start, endMinutes: end };
}

function toMinutes(hour: number, minute: number, meridiem: string): number | null {
  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null;
  const h24 = meridiem.toUpperCase() === "PM" ? (hour % 12) + 12 : hour % 12;
  return h24 * 60 + minute;
}

export function istMinutesOfDay(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = parts.find((p) => p.type === "hour")?.value ?? "0";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "0";
  return Number(hour) * 60 + Number(minute);
}

export function isCurrentMeal(
  meal: Pick<MealPeriod, "window">,
  nowMinutes: number,
): boolean {
  if (!meal.window) return false;
  return (
    nowMinutes >= meal.window.startMinutes && nowMinutes < meal.window.endMinutes
  );
}

export function deriveServeStatus(
  meal: Pick<MealPeriod, "window" | "servedAt">,
  nowMinutes: number,
): ServeStatus {
  if (meal.servedAt) {
    const served = meal.servedAt.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (served) {
      const minutes = toMinutes(
        Number(served[1]),
        Number(served[2]),
        served[3],
      );
      if (minutes !== null && nowMinutes >= minutes) return "served";
    }
  }
  if (meal.window && nowMinutes >= meal.window.endMinutes) return "served";
  return "upcoming";
}

export function sortMeals(meals: MealPeriod[]): MealPeriod[] {
  return [...meals].sort((a, b) =>
    a.order !== b.order ? a.order - b.order : a.name.localeCompare(b.name),
  );
}
