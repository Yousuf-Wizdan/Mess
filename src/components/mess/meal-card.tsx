import { formatIst } from "@/lib/format";
import { isCurrentMeal, istMinutesOfDay, sortMeals } from "@/lib/menu";
import type { MealPeriod, MenuSnapshot } from "@/types/menu";
import { Clock } from "lucide-react";

function ServeChip({ meal }: { meal: MealPeriod }) {
  if (meal.serveStatus === "served") {
    return (
      <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
        Served{meal.servedAt ? ` at ${meal.servedAt}` : ""}
      </span>
    );
  }
  return (
    <span className="rounded-full border px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
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
  const time = meal.timeLabel.replace(/^\w+\s+/, "");
  return (
    <article
      className={`rise flex flex-col rounded-xl border bg-card text-card-foreground transition-shadow ${
        current ? "shadow-md" : "hover:shadow-sm"
      }`}
      style={
        {
          ...(current
            ? {
                borderColor: meal.accentColor,
                background: `linear-gradient(to bottom, ${meal.accentColor}14, transparent 140px)`,
              }
            : {}),
          "--i": index,
        } as React.CSSProperties
      }
    >
      <div className="p-5 pb-4">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-base font-semibold tracking-tight">{meal.name}</h3>
          {current ? (
            <span className="rounded-full bg-foreground px-2.5 py-0.5 text-xs font-semibold text-background">
              Now serving
            </span>
          ) : (
            <ServeChip meal={meal} />
          )}
        </div>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
          <Clock className="size-3.5 shrink-0" aria-hidden />
          {time}
        </p>
      </div>
      <ul className="flex-1 space-y-2 border-t px-5 py-4">
        {meal.dishes.map((dish) => (
          <li key={dish.name} className="flex items-baseline justify-between gap-3 text-sm leading-snug">
            <span>{dish.name}</span>
            {dish.kcal !== undefined && (
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {dish.kcal}
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
    <div className="flex flex-col rounded-xl border">
      <div className="p-5 pb-4">
        <div className="h-5 w-24 animate-pulse rounded-md bg-muted" />
        <div className="mt-2 h-3.5 w-36 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="space-y-2.5 border-t px-5 py-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-4 w-full animate-pulse rounded-md bg-muted" />
        ))}
      </div>
    </div>
  );
}

export function EmptyMenuState() {
  return (
    <div className="mx-auto max-w-md rounded-xl border border-dashed p-10 text-center">
      <h3 className="text-lg font-semibold tracking-tight">Nothing published yet</h3>
      <p className="mt-1.5 text-sm text-muted-foreground">
        The mess has not published today&apos;s menu yet. Check back shortly.
      </p>
    </div>
  );
}

export function UnconfiguredSessionState() {
  return (
    <div className="mx-auto max-w-md rounded-xl border border-dashed p-10 text-center">
      <h3 className="text-lg font-semibold tracking-tight">Hosteller session not configured</h3>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Set the hosteller credentials in the server environment to enable menu fetching.
      </p>
    </div>
  );
}

export function StaleBanner({ updatedAt }: { updatedAt: string }) {
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
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
