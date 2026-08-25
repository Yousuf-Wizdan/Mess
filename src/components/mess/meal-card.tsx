import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { formatIst } from "@/lib/format";
import { isCurrentMeal, istMinutesOfDay, sortMeals } from "@/lib/menu";
import type { MealPeriod, MenuSnapshot } from "@/types/menu";
import { Clock, MapPin, UtensilsCrossed } from "lucide-react";

export function MealCard({
  meal,
  nowMinutes = istMinutesOfDay(),
}: {
  meal: MealPeriod;
  nowMinutes?: number;
}) {
  const current = isCurrentMeal(meal, nowMinutes);
  return (
    <Card
      className={`flex flex-col overflow-hidden pt-0 transition-shadow ${
        current
          ? "border-2 shadow-lg ring-2"
          : "opacity-90 hover:shadow-md"
      }`}
      style={
        current
          ? ({
              borderColor: meal.accentColor,
              "--tw-ring-color": `${meal.accentColor}55`,
            } as React.CSSProperties)
          : undefined
      }
    >
      <div className="h-1.5 w-full" style={{ backgroundColor: meal.accentColor }} />
      <CardHeader className="gap-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            <UtensilsCrossed
              className="size-4 shrink-0"
              style={{ color: meal.accentColor }}
            />
            {meal.name}
          </h3>
          {current ? (
            <Badge className="text-white" style={{ backgroundColor: meal.accentColor }}>
              Now serving
            </Badge>
          ) : meal.serveStatus === "served" ? (
            <Badge variant="secondary">Served{meal.servedAt ? ` @ ${meal.servedAt}` : ""}</Badge>
          ) : (
            <Badge variant="outline">Upcoming</Badge>
          )}
        </div>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Clock className="size-3.5" /> {meal.timeLabel.replace(/^\w+\s+/, "")}
        </p>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="size-3.5" /> {meal.facility}
        </p>
      </CardHeader>
      <CardContent className="flex-1">
        <ul className="space-y-1.5">
          {meal.dishes.map((dish) => (
            <li key={dish.name} className="flex items-baseline justify-between gap-2 text-sm">
              <span>{dish.name}</span>
              {dish.kcal !== undefined && (
                <Badge variant="outline" className="shrink-0 tabular-nums">
                  {dish.kcal} kcal
                </Badge>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground">
        {meal.dishes.length} item{meal.dishes.length === 1 ? "" : "s"}
      </CardFooter>
    </Card>
  );
}

export function MealCardSkeleton() {
  return (
    <Card className="flex flex-col overflow-hidden pt-0">
      <div className="h-1.5 w-full bg-muted" />
      <CardHeader className="gap-2">
        <SkeletonLine className="h-5 w-28" />
        <SkeletonLine className="h-3.5 w-40" />
        <SkeletonLine className="h-3 w-24" />
      </CardHeader>
      <CardContent className="space-y-2">
        {[...Array(4)].map((_, i) => (
          <SkeletonLine key={i} className="h-4 w-full" />
        ))}
      </CardContent>
      <CardFooter>
        <SkeletonLine className="h-3 w-14" />
      </CardFooter>
    </Card>
  );
}

function SkeletonLine({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className ?? ""}`} />;
}

export function EmptyMenuState() {
  return (
    <Card className="mx-auto max-w-md border-dashed text-center">
      <CardHeader>
        <CardTitleLevel>Nothing published yet</CardTitleLevel>
        <p className="text-sm text-muted-foreground">
          The mess hasn&apos;t published today&apos;s menu. Check back shortly.
        </p>
      </CardHeader>
    </Card>
  );
}

export function UnconfiguredSessionState() {
  return (
    <Card className="mx-auto max-w-md border-dashed text-center">
      <CardHeader>
        <CardTitleLevel>Hosteller session not configured</CardTitleLevel>
        <p className="text-sm text-muted-foreground">
          Set the hosteller credentials in the server environment to enable menu
          fetching. This is a server-side configuration step.
        </p>
      </CardHeader>
    </Card>
  );
}

function CardTitleLevel({ children }: { children: React.ReactNode }) {
  return <h3 className="text-lg font-semibold">{children}</h3>;
}

export function StaleBanner({ updatedAt }: { updatedAt: string }) {
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
      Showing last available menu — live fetch failed. Last updated{" "}
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
    <div className="space-y-4">
      {stale && <StaleBanner updatedAt={snapshot.updatedAt} />}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {sortMeals(snapshot.meals).map((meal) => (
          <MealCard key={meal.id} meal={meal} nowMinutes={nowMinutes} />
        ))}
      </div>
    </div>
  );
}
