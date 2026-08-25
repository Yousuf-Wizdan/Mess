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
    <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <UtensilsCrossed className="size-4" />
          </span>
          <span className="text-lg font-semibold tracking-tight">Bennett Mess</span>
          <Badge variant="secondary" className="hidden sm:inline-flex">
            Bennett University
          </Badge>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {snapshot && (
            <span className="hidden text-sm text-muted-foreground md:inline">
              {formatIstDay(snapshot.date)} · updated {formatIst(snapshot.updatedAt)}
            </span>
          )}
          <StatusPill health={health} />
          <Button
            variant="outline"
            size="sm"
            disabled={refreshing || !onRefresh}
            onClick={onRefresh}
          >
            <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>
    </header>
  );
}

