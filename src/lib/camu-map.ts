import type { CamuMenuResponse } from "@/types/camu";
import {
  MealPeriod,
  MenuSnapshot,
} from "@/types/menu";
import {
  deriveServeStatus,
  istMinutesOfDay,
  mealOrder,
  parseDishes,
  parseMealName,
  parseMealWindow,
} from "@/lib/menu";

export class EmptyMenuError extends Error {
  constructor(message = "No menu is currently published") {
    super(message);
    this.name = "EmptyMenuError";
  }
}

export function mapCamuMenu(
  response: CamuMenuResponse,
  fetchedAt: Date = new Date(),
): MenuSnapshot {
  const data = response.output?.data;
  if (!data || !response.output || response.output.errors !== null) {
    throw new Error("Camu returned an error payload");
  }
  if (data.isAtve === false || !data.oMealList || data.oMealList.length === 0) {
    throw new EmptyMenuError();
  }

  const nowMinutes = istMinutesOfDay(fetchedAt);
  const meals: MealPeriod[] = data.oMealList.map((raw) => {
    const name = parseMealName(raw.msCde);
    const window = parseMealWindow(raw.mealTm);
    return {
      id: raw._id,
      name,
      order: mealOrder(name),
      timeLabel: raw.mealTm,
      window,
      facility: raw.availFac ?? data.facNme ?? "Mess",
      accentColor: raw.mealClr ?? "#f97316",
      serveStatus: deriveServeStatus(
        { window, servedAt: raw.srvDte },
        nowMinutes,
      ),
      servedAt: raw.srvSts === "S" ? raw.srvDte : undefined,
      dishes: parseDishes(raw.msNme),
    };
  });

  return {
    date: data.curntDte ?? fetchedAt.toISOString(),
    facility: data.facNme ?? "Bennett Mess",
    meals,
    updatedAt: fetchedAt.toISOString(),
  };
}
