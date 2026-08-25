import { Badge } from "@/components/ui/badge";
import type { MenuHealth } from "@/types/menu";
import { CircleDot } from "lucide-react";

const HEALTH_CONFIG: Record<
  MenuHealth,
  { label: string; className: string; dot: string }
> = {
  live: {
    label: "Live",
    className: "bg-emerald-100 text-emerald-800 border-emerald-300",
    dot: "bg-emerald-500",
  },
  stale: {
    label: "Stale",
    className: "bg-amber-100 text-amber-800 border-amber-300",
    dot: "bg-amber-500",
  },
  offline: {
    label: "Offline",
    className: "bg-red-100 text-red-800 border-red-300",
    dot: "bg-red-500",
  },
};

export function StatusPill({ health }: { health: MenuHealth }) {
  const config = HEALTH_CONFIG[health];
  return (
    <Badge variant="outline" className={`gap-1.5 ${config.className}`}>
      <CircleDot className={`size-3 fill-current ${config.dot} text-transparent`} />
      {config.label}
    </Badge>
  );
}
