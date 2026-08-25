import type { KvStore } from "@/lib/kv";
import { logError, logEvent } from "@/lib/log";
import {
  MISTRAL_CACHE_TTL_SECONDS,
  dishesMissingMacros,
  normalizeDishName,
} from "@/lib/nutrition";
import { OVERRIDES } from "@/lib/nutrition-overrides";
import type { Macros, MenuSnapshot, MacroSource } from "@/types/menu";

export const MISTRAL_CACHE_PREFIX = "nutrition:dish:";

const DEFAULT_MODEL = "mistral-small-latest";
const DEFAULT_BASE_URL = "https://api.mistral.ai/v1";
const REQUEST_TIMEOUT_MS = 15_000;

export interface NutritionConfig {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}

interface CachedEstimate {
  macros: Macros;
  estimatedAt: string;
}

interface MistralItem {
  name?: unknown;
  protein_g?: unknown;
  carbs_g?: unknown;
  fat_g?: unknown;
}

interface ResolvedMacro {
  macros: Macros;
  source: MacroSource;
}

function cacheKey(name: string): string {
  return `${MISTRAL_CACHE_PREFIX}${normalizeDishName(name)}`;
}

function toMacros(item: MistralItem): Macros | null {
  return validMacros({
    proteinG: Number(item.protein_g),
    carbsG: Number(item.carbs_g),
    fatG: Number(item.fat_g),
  })
    ? {
        proteinG: Math.round(Number(item.protein_g) * 10) / 10,
        carbsG: Math.round(Number(item.carbs_g) * 10) / 10,
        fatG: Math.round(Number(item.fat_g) * 10) / 10,
      }
    : null;
}

function validMacros(value: unknown): value is Macros {
  if (typeof value !== "object" || value === null) return false;
  const m = value as Record<string, unknown>;
  return (
    typeof m.proteinG === "number" &&
    typeof m.carbsG === "number" &&
    typeof m.fatG === "number" &&
    [m.proteinG, m.carbsG, m.fatG].every((n) => Number.isFinite(n) && n >= 0)
  );
}

export class NutritionEnricher {
  private readonly apiKey?: string;
  private readonly model: string;
  private readonly baseUrl: string;

  constructor(
    private readonly kv: KvStore,
    private readonly fetchFn: typeof fetch,
    config: NutritionConfig = {},
  ) {
    this.apiKey = config.apiKey ?? process.env.MISTRAL_API_KEY;
    this.model = config.model ?? process.env.MISTRAL_MODEL ?? DEFAULT_MODEL;
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  }

  async enrichSnapshot(snapshot: MenuSnapshot): Promise<MenuSnapshot> {
    try {
      return await this.enrich(snapshot);
    } catch (error) {
      logError("nutrition.enrich.failed", error, {});
      return snapshot;
    }
  }

  private async enrich(snapshot: MenuSnapshot): Promise<MenuSnapshot> {
    const missing = dishesMissingMacros(snapshot.meals);
    if (missing.length === 0) return snapshot;

    const resolved = new Map<string, ResolvedMacro>();

    for (const dish of missing) {
      const key = normalizeDishName(dish.name);
      const macros = OVERRIDES[key];
      if (macros) resolved.set(key, { macros, source: "curated" });
    }

    const cacheMisses: string[] = [];
    await Promise.all(
      missing.map(async (dish) => {
        const key = normalizeDishName(dish.name);
        if (resolved.has(key)) return;
        const cached = await this.kv.get<CachedEstimate>(cacheKey(dish.name));
        if (cached && validMacros(cached.macros)) {
          resolved.set(key, { macros: cached.macros, source: "estimated" });
        } else if (!cacheMisses.includes(dish.name)) {
          cacheMisses.push(dish.name);
        }
      }),
    );

    if (cacheMisses.length > 0 && this.apiKey) {
      const estimated = await this.estimateBatch(cacheMisses);
      for (const [name, macros] of estimated) {
        resolved.set(normalizeDishName(name), { macros, source: "estimated" });
        await this.kv.set(
          cacheKey(name),
          { macros, estimatedAt: new Date().toISOString() } satisfies CachedEstimate,
          MISTRAL_CACHE_TTL_SECONDS,
        );
      }
    }

    if (resolved.size === 0) return snapshot;

    logEvent("nutrition.enrich", {
      curated: [...resolved.values()].filter((r) => r.source === "curated").length,
      estimated: [...resolved.values()].filter((r) => r.source === "estimated").length,
    });

    return {
      ...snapshot,
      meals: snapshot.meals.map((meal) => ({
        ...meal,
        dishes: meal.dishes.map((dish) => {
          const hit = resolved.get(normalizeDishName(dish.name));
          if (!hit || dish.macros) return dish;
          return { ...dish, macros: hit.macros, macroSource: hit.source };
        }),
      })),
    };
  }

  private async estimateBatch(names: string[]): Promise<Map<string, Macros>> {
    const out = new Map<string, Macros>();
    try {
      const response = await this.fetchFn(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                'You are a nutrition database for Indian college mess food. For each dish, estimate macronutrients per standard serving. Respond with JSON: {"items":[{"name":"<dish name>","protein_g":<number>,"carbs_g":<number>,"fat_g":<number>}]} . Use only the dishes given.',
            },
            {
              role: "user",
              content: `Dishes:\n${names.join("\n")}`,
            },
          ],
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) {
        logEvent("nutrition.llm.http_error", { status: response.status });
        return out;
      }
      const payload = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = payload.choices?.[0]?.message?.content;
      if (!content) return out;
      const parsed = JSON.parse(content) as { items?: MistralItem[] };
      for (const item of parsed.items ?? []) {
        if (typeof item?.name !== "string") continue;
        if (
          !names.some(
            (n) => normalizeDishName(n) === normalizeDishName(item.name as string),
          )
        ) {
          continue;
        }
        const macros = toMacros(item);
        if (macros) out.set(item.name, macros);
      }
    } catch (error) {
      logError("nutrition.llm.failed", error, {});
    }
    return out;
  }
}
