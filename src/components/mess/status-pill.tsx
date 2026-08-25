import type { MenuHealth } from "@/types/menu";

const HEALTH_LABEL: Record<MenuHealth, string> = {
  live: "Live",
  stale: "Stale",
  offline: "Offline",
};

const HEALTH_STYLE: Record<MenuHealth, string> = {
  live: "border-emerald-600/30 bg-emerald-50 text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-950 dark:text-emerald-300",
  stale:
    "border-amber-600/30 bg-amber-50 text-amber-800 dark:border-amber-400/20 dark:bg-amber-950 dark:text-amber-300",
  offline:
    "border-red-600/30 bg-red-50 text-red-800 dark:border-red-400/20 dark:bg-red-950 dark:text-red-300",
};

export function StatusPill({ health }: { health: MenuHealth }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${HEALTH_STYLE[health]}`}
    >
      <span
        aria-hidden
        className={`size-1.5 rounded-full ${
          health === "live"
            ? "bg-emerald-600 dark:bg-emerald-400"
            : health === "stale"
              ? "bg-amber-600 dark:bg-amber-400"
              : "bg-red-600 dark:bg-red-400"
        }`}
      />
      {HEALTH_LABEL[health]}
    </span>
  );
}
