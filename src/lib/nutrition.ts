import type { Dish, Macros, MealPeriod } from "@/types/menu";
export const MISTRAL_CACHE_TTL_SECONDS = 30 * 24 * 3_600;

export function normalizeDishName(name: string): string {
  return name.trim().toLowerCase();
}

export interface MealNutritionTotals {
  kcal?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function formatMacros(macros: Macros): string {
  return `P ${round1(macros.proteinG)}g · C ${round1(macros.carbsG)}g · F ${round1(macros.fatG)}g`;
}

export function mealTotals(meal: Pick<MealPeriod, "dishes">): MealNutritionTotals | null {
  let kcal: number | undefined;
  const macros: Macros = { proteinG: 0, carbsG: 0, fatG: 0 };
  let hasMacros = false;
  for (const dish of meal.dishes) {
    if (dish.kcal !== undefined) kcal = (kcal ?? 0) + dish.kcal;
    if (dish.macros) {
      hasMacros = true;
      macros.proteinG += dish.macros.proteinG;
      macros.carbsG += dish.macros.carbsG;
      macros.fatG += dish.macros.fatG;
    }
  }
  if (kcal === undefined && !hasMacros) return null;
  return {
    ...(kcal !== undefined ? { kcal } : {}),
    ...(hasMacros
      ? { proteinG: macros.proteinG, carbsG: macros.carbsG, fatG: macros.fatG }
      : {}),
  };
}

export function dishesMissingMacros(
  meals: Pick<MealPeriod, "dishes">[],
): Dish[] {
  const seen = new Set<string>();
  const missing: Dish[] = [];
  for (const meal of meals) {
    for (const dish of meal.dishes) {
      const key = normalizeDishName(dish.name);
      if (seen.has(key)) continue;
      seen.add(key);
      if (dish.macros) continue;
      missing.push(dish);
    }
  }
  return missing;
}
