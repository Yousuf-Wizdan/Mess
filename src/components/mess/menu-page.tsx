"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import {
  EmptyMenuState,
  MealCardSkeleton,
  MenuBoard,
  UnconfiguredSessionState,
} from "@/components/mess/meal-card";
import { MessNavbar } from "@/components/mess/mess-navbar";
import { formatIst } from "@/lib/format";
import { EMPTY_MENU_MESSAGE } from "@/types/menu";
import type {
  MenuHealth,
  MenuSnapshot,
  MessMenuResponse,
} from "@/types/menu";

type PageState =
  | { kind: "loading" }
  | { kind: "empty" }
  | { kind: "unconfigured" }
  | { kind: "error"; message: string; stale: boolean }
  | { kind: "ready"; snapshot: MenuSnapshot; stale: boolean };

function toPageState(response: MessMenuResponse): PageState {
  if (response.success) {
    return { kind: "ready", snapshot: response.data, stale: response.stale };
  }
  if (response.code === "empty" || response.error === EMPTY_MENU_MESSAGE) {
    return { kind: "empty" };
  }
  if (
    response.code === "unconfigured" ||
    /not configured/i.test(response.error)
  ) {
    return { kind: "unconfigured" };
  }
  return { kind: "error", message: response.error, stale: response.stale };
}

export function MenuPage({ initial }: { initial: MessMenuResponse }) {
  const [state, setState] = useState<PageState>(() => toPageState(initial));
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await fetch("/api/mess-menu?refresh=1", {
        cache: "no-store",
      });
      const body = (await response.json()) as MessMenuResponse;
      setState((prev) => {
        const next = toPageState(body);
        if (
          prev.kind === "ready" &&
          next.kind === "ready" &&
          prev.snapshot.updatedAt !== next.snapshot.updatedAt
        ) {
          toast.success("Menu updated");
        } else if (next.kind !== "ready") {
          toast.error("Refresh failed — showing last available menu");
          return prev;
        }
        return next;
      });
    } catch {
      toast.error("Could not reach the server");
    } finally {
      setRefreshing(false);
    }
  }, []);

  const health: MenuHealth =
    state.kind === "ready"
      ? state.stale
        ? "stale"
        : "live"
      : state.kind === "unconfigured" || state.kind === "loading"
        ? "live"
        : state.kind === "empty"
          ? "live"
          : "offline";

  return (
    <>
      <MessNavbar
        health={health}
        snapshot={state.kind === "ready" ? state.snapshot : null}
        refreshing={refreshing}
        onRefresh={() => void refresh()}
      />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <div className="rise mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Today&apos;s menu</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {state.kind === "ready"
              ? `${state.snapshot.facility}, updated ${formatIst(state.snapshot.updatedAt)}`
              : "Bennett University, Ground Floor"}
          </p>
        </div>
        <MenuBody state={state} />
      </main>
      <footer className="border-t py-5 text-center text-xs text-muted-foreground">
        Synced automatically from Camu. Shows today&apos;s published menu only.
      </footer>
    </>
  );
}

function MenuBody({ state }: { state: PageState }) {
  switch (state.kind) {
    case "loading":
      return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <MealCardSkeleton key={i} />
          ))}
        </div>
      );
    case "empty":
      return <EmptyMenuState />;
    case "unconfigured":
      return <UnconfiguredSessionState />;
    case "error":
      return (
        <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          {state.message}
        </div>
      );
    case "ready":
      return <MenuBoard snapshot={state.snapshot} stale={state.stale} />;
  }
}
