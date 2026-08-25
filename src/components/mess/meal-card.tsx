import { formatIst } from "@/lib/format";
import {
  isCurrentMeal,
  istMinutesOfDay,
  liveMealState,
  sortMeals,
} from "@/lib/menu";
import type { MealPeriod, MenuSnapshot } from "@/types/menu";
import { createElement } from "react";
import {
  Clock,
  Cookie,
  MoonStar,
  Sun,
  Sunrise,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

const MEAL_ICONS: LucideIcon[] = [Sunrise, Sun, Cookie, MoonStar];

function mealIcon(meal: MealPeriod): LucideIcon {
  return MEAL_ICONS[meal.order] ?? UtensilsCrossed;
}

function readableTextColor(hex: string): string {
  const raw = hex.replace("#", "");
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw.padEnd(6, "0").slice(0, 6);
  const channels = [0, 2, 4].map((i) => {
    const v = parseInt(full.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  const luminance =
    0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  return luminance > 0.4 ? "#292524" : "#ffffff";
}

function ServeChip({ state, servedAt }: { state: "served" | "upcoming"; servedAt?: string }) {
  if (state === "served") {
    return (
      <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
        Served{servedAt ? ` at ${servedAt}` : ""}
      </span>
    );
  }
  return (
    <span className="rounded-full border border-border bg-background/60 px-2.5 py-1 text-xs font-medium text-muted-foreground">
      Upcoming
    </span>
  );
}

export function MealCard({
  meal,
  nowMinutes = istMinutesOfDay(),
  index = 0,
}: {
  meal: MealPeriod;
  nowMinutes?: number;
  index?: number;
}) {
  const current = isCurrentMeal(meal, nowMinutes);
  const live = liveMealState(meal, nowMinutes);
  const Icon = mealIcon(meal);
  const time = meal.timeLabel.replace(/^\w+\s+/, "");
  return (
    <article
      className={`rise flex flex-col overflow-hidden rounded-2xl border bg-card text-card-foreground transition-all ${
        current ? "shadow-lg shadow-black/10 dark:shadow-black/40" : "hover:-translate-y-0.5 hover:shadow-md"
      }`}
      style={{
        ...(current ? { borderColor: meal.accentColor } : {}),
        "--i": index,
      } as React.CSSProperties}
    >
      <header
        className="flex items-start justify-between gap-3 p-5 pb-4"
        style={{
          background: `linear-gradient(135deg, ${meal.accentColor}26, ${meal.accentColor}0d)`,
          borderBottom: `1px solid ${meal.accentColor}33`,
        }}
      >
        <div className="flex items-center gap-3">
          <span
            className="flex size-10 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${meal.accentColor}2e`, color: meal.accentColor }}
          >
            {createElement(Icon, {
              className: "size-5",
              "aria-hidden": true,
              strokeWidth: 2,
            })}
          </span>
          <div>
            <h3 className="text-lg font-bold leading-tight tracking-tight">{meal.name}</h3>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Clock className="size-3 shrink-0" aria-hidden />
              {time}
            </p>
          </div>
        </div>
        <div>
          {current ? (
            <span
              className="rounded-full px-2.5 py-1 text-xs font-bold shadow-sm"
              style={{
                backgroundColor: meal.accentColor,
                color: readableTextColor(meal.accentColor),
              }}
            >
              Now serving
            </span>
          ) : (
            <ServeChip
              state={live.state === "served" ? "served" : "upcoming"}
              servedAt={live.servedAt}
            />
          )}
        </div>
      </header>
      <ul className="flex-1 space-y-2.5 px-5 py-4">
        {meal.dishes.map((dish) => (
          <li key={dish.name} className="flex items-baseline justify-between gap-3 text-sm leading-snug">
            <span>{dish.name}</span>
            {dish.kcal !== undefined && (
              <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                {dish.kcal} kcal
              </span>
            )}
          </li>
        ))}
      </ul>
    </article>
  );
}

export function MealCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border">
      <div className="flex items-center gap-3 p-5 pb-4">
        <div className="size-10 animate-pulse rounded-xl bg-muted" />
        <div className="flex-1">
          <div className="h-5 w-24 animate-pulse rounded-md bg-muted" />
          <div className="mt-2 h-3 w-32 animate-pulse rounded-md bg-muted" />
        </div>
      </div>
      <div className="space-y-2.5 px-5 py-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-4 w-full animate-pulse rounded-md bg-muted" />
        ))}
      </div>
    </div>
  );
}

export function EmptyMenuState() {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-dashed p-10 text-center">
      <UtensilsCrossed className="mx-auto size-8 text-muted-foreground/60" aria-hidden />
      <h3 className="mt-3 text-lg font-semibold tracking-tight">Nothing published yet</h3>
      <p className="mt-1.5 text-sm text-muted-foreground">
        The mess has not published today&apos;s menu yet. Check back shortly.
      </p>
    </div>
  );
}

export function UnconfiguredSessionState() {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-dashed p-10 text-center">
      <h3 className="text-lg font-semibold tracking-tight">Hosteller session not configured</h3>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Set the hosteller credentials in the server environment to enable menu fetching.
      </p>
    </div>
  );
}

export function StaleBanner({ updatedAt }: { updatedAt: string }) {
  return (
    <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
      Showing the last available menu because the live fetch failed. Last updated{" "}
      {formatIst(updatedAt)}.
    </div>
  );
}

export function MenuBoard({
  snapshot,
  stale = false,
}: {
  snapshot: MenuSnapshot;
  stale?: boolean;
}) {
  const nowMinutes = istMinutesOfDay();
  return (
    <div className="space-y-5">
      {stale && <StaleBanner updatedAt={snapshot.updatedAt} />}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {sortMeals(snapshot.meals).map((meal, i) => (
          <MealCard key={meal.id} meal={meal} nowMinutes={nowMinutes} index={i} />
        ))}
      </div>
    </div>
  );
}
