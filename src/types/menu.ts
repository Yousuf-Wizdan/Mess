export interface Macros {
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export type MacroSource = "curated" | "estimated";

export interface Dish {
  name: string;
  kcal?: number;
  macros?: Macros;
  macroSource?: MacroSource;
}

export type ServeStatus = "upcoming" | "served";

export interface MealWindow {
  startMinutes: number;
  endMinutes: number;
}

export interface MealPeriod {
  id: string;
  name: string;
  order: number;
  timeLabel: string;
  window: MealWindow | null;
  facility: string;
  accentColor: string;
  serveStatus: ServeStatus;
  servedAt?: string;
  dishes: Dish[];
}

export interface MenuSnapshot {
  date: string;
  facility: string;
  meals: MealPeriod[];
  updatedAt: string;
}

export type MenuHealth = "live" | "stale" | "offline";

export interface MessMenuSuccess {
  success: true;
  data: MenuSnapshot;
  updatedAt: string;
  stale: boolean;
}

export interface MessMenuFailure {
  success: false;
  error: string;
  code?: "unconfigured" | "empty";
  stale: boolean;
}

export type MessMenuResponse = MessMenuSuccess | MessMenuFailure;

export const MEAL_ORDER: readonly string[] = [
  "Breakfast",
  "Lunch",
  "Snack",
  "Dinner",
] as const;

export const EMPTY_MENU_MESSAGE = "No menu is currently published";
