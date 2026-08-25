import { beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryKv } from "@/lib/kv-memory";
import {
  NutritionEnricher,
  MISTRAL_CACHE_PREFIX,
} from "@/lib/nutrition-enricher";
import { mealTotals, normalizeDishName } from "@/lib/nutrition";
import { OVERRIDES } from "@/lib/nutrition-overrides";
import type { MealPeriod, MenuSnapshot } from "@/types/menu";

function makeMeal(name: string, dishes: MealPeriod["dishes"]): MealPeriod {
  return {
    id: name.toLowerCase(),
    name,
    order: 0,
    timeLabel: "8:00 AM - 10:00 AM",
    window: { startMinutes: 480, endMinutes: 600 },
    facility: "GF",
    accentColor: "#f59e0b",
    serveStatus: "upcoming",
    dishes,
  };
}

function makeSnapshot(meals: MealPeriod[]): MenuSnapshot {
  return {
    date: "2026-08-25",
    facility: "GF",
    meals,
    updatedAt: new Date().toISOString(),
  };
}

function mistralResponse(items: unknown): Response {
  return new Response(
    JSON.stringify({
      choices: [
        { message: { content: JSON.stringify({ items }) } },
      ],
    }),
    { status: 200 },
  );
}

type FetchLike = typeof fetch;

let fetchFn: ReturnType<typeof vi.fn<FetchLike>>;

beforeEach(() => {
  fetchFn = vi.fn();
  delete process.env.MISTRAL_API_KEY;
});

describe("normalizeDishName", () => {
  it("lowercases and trims", () => {
    expect(normalizeDishName("  Dal Tadka ")).toBe("dal tadka");
  });
});

describe("mealTotals", () => {
  it("sums kcal and macros over dishes that have data", () => {
    const meal = makeMeal("Breakfast", [
      { name: "A", kcal: 100, macros: { proteinG: 5, carbsG: 15, fatG: 3 }, macroSource: "curated" },
      { name: "B", kcal: 50 },
      { name: "C", macros: { proteinG: 10, carbsG: 20, fatG: 4 }, macroSource: "estimated" },
      { name: "D" },
    ]);
    expect(mealTotals(meal)).toEqual({
      kcal: 150,
      proteinG: 15,
      carbsG: 35,
      fatG: 7,
    });
  });

  it("returns nulls when no dish has data", () => {
    const meal = makeMeal("Breakfast", [{ name: "A" }, { name: "B" }]);
    expect(mealTotals(meal)).toBeNull();
  });
});

describe("NutritionEnricher", () => {
  it("uses curated overrides and never calls the LLM for those dishes", async () => {
    const kv = new InMemoryKv();
    const enricher = new NutritionEnricher(kv, fetchFn, { apiKey: "k" });
    const [overrideName] = Object.keys(OVERRIDES);
    const snapshot = makeSnapshot([
      makeMeal("Breakfast", [{ name: overrideName.toUpperCase() }]),
    ]);

    const out = await enricher.enrichSnapshot(snapshot);

    expect(fetchFn).not.toHaveBeenCalled();
    expect(out.meals[0].dishes[0].macroSource).toBe("curated");
    expect(out.meals[0].dishes[0].macros).toEqual(OVERRIDES[overrideName]);
  });

  it("serves cached estimates without calling the LLM", async () => {
    const kv = new InMemoryKv();
    const cached = { macros: { proteinG: 2, carbsG: 30, fatG: 1 }, estimatedAt: "2026-08-01T00:00:00Z" };
    await kv.set(`${MISTRAL_CACHE_PREFIX}${normalizeDishName("Upma")}`, cached);
    const enricher = new NutritionEnricher(kv, fetchFn, { apiKey: "k" });
    const snapshot = makeSnapshot([makeMeal("Breakfast", [{ name: "upma" }])]);

    const out = await enricher.enrichSnapshot(snapshot);

    expect(fetchFn).not.toHaveBeenCalled();
    expect(out.meals[0].dishes[0].macros).toEqual(cached.macros);
    expect(out.meals[0].dishes[0].macroSource).toBe("estimated");
  });

  it("batches unknown dishes into one LLM call and caches each result", async () => {
    const kv = new InMemoryKv();
    fetchFn.mockResolvedValue(
      mistralResponse([
        { name: "Upma", protein_g: 4, carbs_g: 38, fat_g: 7 },
        { name: "Medu Vada", protein_g: 5, carbs_g: 22, fat_g: 9 },
      ]),
    );
    const enricher = new NutritionEnricher(kv, fetchFn, { apiKey: "k" });
    const snapshot = makeSnapshot([
      makeMeal("Breakfast", [{ name: "Upma" }, { name: "Medu Vada" }]),
    ]);

    const out = await enricher.enrichSnapshot(snapshot);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe("mistral-small-latest");
    const prompt = body.messages.map((m: { content: string }) => m.content).join("\n");
    expect(prompt).toContain("Upma");
    expect(prompt).toContain("Medu Vada");

    expect(out.meals[0].dishes[0].macros).toEqual({ proteinG: 4, carbsG: 38, fatG: 7 });
    expect(out.meals[0].dishes[0].macroSource).toBe("estimated");

    const second = await enricher.enrichSnapshot(snapshot);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(second.meals[0].dishes[0].macroSource).toBe("estimated");
  });

  it("prefers curated overrides over a stale cache entry", async () => {
    const kv = new InMemoryKv();
    const [overrideName] = Object.keys(OVERRIDES);
    await kv.set(`${MISTRAL_CACHE_PREFIX}${normalizeDishName(overrideName)}`, {
      macros: { proteinG: 99, carbsG: 99, fatG: 99 },
      estimatedAt: "2026-08-01T00:00:00Z",
    });
    const enricher = new NutritionEnricher(kv, fetchFn, { apiKey: "k" });
    const snapshot = makeSnapshot([makeMeal("Breakfast", [{ name: overrideName }])]);

    const out = await enricher.enrichSnapshot(snapshot);

    expect(fetchFn).not.toHaveBeenCalled();
    expect(out.meals[0].dishes[0].macroSource).toBe("curated");
    expect(out.meals[0].dishes[0].macros).toEqual(OVERRIDES[overrideName]);
  });

  it("treats a corrupted cache entry as a miss instead of trusting it", async () => {
    const kv = new InMemoryKv();
    await kv.set(`${MISTRAL_CACHE_PREFIX}${normalizeDishName("Upma")}`, {
      macros: { proteinG: "lots", carbsG: -3, fatG: null },
      estimatedAt: "2026-08-01T00:00:00Z",
    });
    fetchFn.mockResolvedValue(
      mistralResponse([{ name: "Upma", protein_g: 4, carbs_g: 38, fat_g: 7 }]),
    );
    const enricher = new NutritionEnricher(kv, fetchFn, { apiKey: "k" });
    const snapshot = makeSnapshot([makeMeal("Breakfast", [{ name: "Upma" }])]);

    const out = await enricher.enrichSnapshot(snapshot);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(out.meals[0].dishes[0].macros).toEqual({ proteinG: 4, carbsG: 38, fatG: 7 });
  });

  it("estimates a duplicated no-macro dish only once", async () => {
    const kv = new InMemoryKv();
    fetchFn.mockResolvedValue(
      mistralResponse([{ name: "Upma", protein_g: 4, carbs_g: 38, fat_g: 7 }]),
    );
    const enricher = new NutritionEnricher(kv, fetchFn, { apiKey: "k" });
    const snapshot = makeSnapshot([
      makeMeal("Lunch", [
        { name: "Rice", kcal: 100, macros: { proteinG: 2, carbsG: 22, fatG: 0 }, macroSource: "curated" },
        { name: "Upma" },
        { name: "upma" },
      ]),
    ]);

    const out = await enricher.enrichSnapshot(snapshot);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    const userContent = body.messages.find(
      (m: { role: string }) => m.role === "user",
    ).content as string;
    expect(userContent.match(/Upma/gi)).toHaveLength(1);
    for (const meal of out.meals) {
      for (const dish of meal.dishes) {
        if (normalizeDishName(dish.name) === "upma") {
          expect(dish.macros).toEqual({ proteinG: 4, carbsG: 38, fatG: 7 });
        }
      }
    }
  });

  it("keeps going when the LLM call fails entirely", async () => {
    const kv = new InMemoryKv();
    fetchFn.mockRejectedValue(new Error("boom"));
    const enricher = new NutritionEnricher(kv, fetchFn, { apiKey: "k" });
    const snapshot = makeSnapshot([makeMeal("Breakfast", [{ name: "Mystery Curry" }])]);

    const out = await enricher.enrichSnapshot(snapshot);

    expect(out.meals[0].dishes[0].macros).toBeUndefined();
    expect(out.meals[0].dishes[0]).toEqual({ name: "Mystery Curry" });
  });

  it("ignores malformed entries but keeps valid ones from the same batch", async () => {
    const kv = new InMemoryKv();
    fetchFn.mockResolvedValue(
      mistralResponse([
        { name: "Good Dish", protein_g: 4, carbs_g: 10, fat_g: 2 },
        { name: "Bad Dish", protein_g: "lots", carbs_g: 10, fat_g: 2 },
        { name: "Negative Dish", protein_g: -5, carbs_g: 10, fat_g: 2 },
        "not an object",
      ]),
    );
    const enricher = new NutritionEnricher(kv, fetchFn, { apiKey: "k" });
    const snapshot = makeSnapshot([
      makeMeal("Breakfast", [{ name: "Good Dish" }, { name: "Bad Dish" }, { name: "Negative Dish" }]),
    ]);

    const out = await enricher.enrichSnapshot(snapshot);

    const byName = Object.fromEntries(out.meals[0].dishes.map((d) => [d.name, d]));
    expect(byName["Good Dish"].macros).toBeDefined();
    expect(byName["Bad Dish"].macros).toBeUndefined();
    expect(byName["Negative Dish"].macros).toBeUndefined();
  });

  it("does nothing when no API key is configured", async () => {
    const kv = new InMemoryKv();
    const enricher = new NutritionEnricher(kv, fetchFn);
    const snapshot = makeSnapshot([makeMeal("Breakfast", [{ name: "Mystery Curry" }])]);

    const out = await enricher.enrichSnapshot(snapshot);

    expect(fetchFn).not.toHaveBeenCalled();
    expect(out.meals[0].dishes[0].macros).toBeUndefined();
  });

  it("skips dishes that already carry macros", async () => {
    const kv = new InMemoryKv();
    const enricher = new NutritionEnricher(kv, fetchFn, { apiKey: "k" });
    const snapshot = makeSnapshot([
      makeMeal("Breakfast", [
        { name: "Poha", macros: { proteinG: 1, carbsG: 2, fatG: 3 }, macroSource: "curated" },
      ]),
    ]);

    const out = await enricher.enrichSnapshot(snapshot);

    expect(fetchFn).not.toHaveBeenCalled();
    expect(out.meals[0].dishes[0].macroSource).toBe("curated");
  });
});
