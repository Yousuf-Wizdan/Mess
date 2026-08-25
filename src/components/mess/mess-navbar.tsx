import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/mess/status-pill";
import { formatIst, formatIstDay } from "@/lib/format";
import type { MenuHealth, MenuSnapshot } from "@/types/menu";
import { RefreshCw, UtensilsCrossed } from "lucide-react";

export function MessNavbar({
  health,
  snapshot,
  refreshing = false,
  onRefresh,
}: {
  health: MenuHealth;
  snapshot: MenuSnapshot | null;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  return (
    <header className="sticky top-0 z-10 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <UtensilsCrossed className="size-4" aria-hidden />
        </span>
        <h2 className="text-base font-bold tracking-tight">Bennett Mess</h2>
        <Badge variant="secondary" className="hidden sm:inline-flex">
          Bennett University
        </Badge>
        <Badge variant="outline" className="hidden md:inline-flex">
          Open to all day scholars
        </Badge>
        <div className="ml-auto flex items-center gap-2.5 sm:gap-3">
          {snapshot && (
            <span className="hidden text-sm text-muted-foreground md:inline">
              {formatIstDay(snapshot.date)}, updated {formatIst(snapshot.updatedAt)}
            </span>
          )}
          <StatusPill health={health} />
          <Button
            variant="outline"
            size="sm"
            disabled={refreshing || !onRefresh}
            onClick={onRefresh}
          >
            <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden />
            Refresh
          </Button>
        </div>
      </div>
    </header>
  );
}
