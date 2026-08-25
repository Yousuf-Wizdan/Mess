import { EmptyMenuError } from "@/lib/camu-map";
import { KvStore } from "@/lib/kv";
import { logEvent } from "@/lib/log";
import { HostellerSession, SessionManager, isHostellerConfigured } from "@/lib/session";
import { EMPTY_MENU_MESSAGE, MenuSnapshot, MessMenuResponse } from "@/types/menu";

const SNAPSHOT_KEY = "mess:snapshot";
const LOCK_KEY = "mess:fetch-lock";
const LOCK_TTL_SECONDS = 60;
const WAIT_FOR_PEER_MS = 8_000;
const POLL_INTERVAL_MS = 100;

export const SNAPSHOT_MAX_AGE_HOURS = 6;
const MAX_AGE_MS = SNAPSHOT_MAX_AGE_HOURS * 3_600_000;

interface StoredSnapshot {
  snapshot: MenuSnapshot;
  storedAt: string;
}

export class MenuService {
  constructor(
    private readonly kv: KvStore,
    private readonly sessionManager: SessionManager,
    private readonly fetchMenu: (
      session: HostellerSession,
    ) => Promise<MenuSnapshot>,
  ) {}

  async getSnapshot(options: { force?: boolean } = {}): Promise<MessMenuResponse> {
    if (!isHostellerConfigured()) {
      return {
        success: false,
        error: "Hosteller session is not configured in the server environment",
        code: "unconfigured",
        stale: false,
      };
    }

    const stored = await this.readStored();
    const needsFetch =
      options.force === true || stored === null || Date.now() - freshBase(stored) > MAX_AGE_MS;

    let snapshot = stored?.snapshot ?? null;
    let emptyPublished = false;

    if (needsFetch && stored !== null && snapshot !== null) {
      void this.withLock(async () => {
        try {
          await this.fetchAndStore();
        } catch {
          logEvent("menu.refresh.background.failed", {});
        }
      });
      logEvent("menu.refresh.background", {});
    } else if (needsFetch && snapshot === null) {
      const fetched = await this.fetchColdBoot();
      if (fetched === "empty") emptyPublished = true;
      else if (fetched) snapshot = fetched;
    }

    if (emptyPublished && snapshot === null) {
      return { success: false, error: EMPTY_MENU_MESSAGE, code: "empty", stale: false };
    }

    if (snapshot === null) {
      return {
        success: false,
        error: "No menu available yet — live fetching did not succeed",
        stale: true,
      };
    }

    return {
      success: true,
      data: snapshot,
      updatedAt: snapshot.updatedAt,
      stale: Date.now() - Date.parse(snapshot.updatedAt) > MAX_AGE_MS,
    };
  }

  async refresh(): Promise<MenuSnapshot | null> {
    let result: MenuSnapshot | null = null;
    await this.withLock(async () => {
      result = await this.fetchAndStore().catch(() => null);
    });
    return result ?? (await this.readStored())?.snapshot ?? null;
  }

  private async fetchColdBoot(): Promise<MenuSnapshot | "empty" | null> {
    const acquired = await this.kv.setIfNotExists(
      LOCK_KEY,
      new Date().toISOString(),
      LOCK_TTL_SECONDS,
    );
    if (!acquired) {
      const waited = await this.waitForSnapshot(WAIT_FOR_PEER_MS);
      if (waited) return waited;
      logEvent("menu.fetch.skipped", { reason: "lock_busy_no_data" });
      return null;
    }
    try {
      return await this.fetchAndStore();
    } catch (error) {
      if (error instanceof EmptyMenuError) return "empty";
      logEvent("menu.fetch.failed.coldboot", {});
      return null;
    } finally {
      await this.kv.delete(LOCK_KEY);
    }
  }

  private async withLock(fn: () => Promise<void>): Promise<void> {
    const acquired = await this.kv.setIfNotExists(
      LOCK_KEY,
      new Date().toISOString(),
      LOCK_TTL_SECONDS,
    );
    if (!acquired) return;
    try {
      await fn();
    } finally {
      await this.kv.delete(LOCK_KEY);
    }
  }

  private async readStored(): Promise<StoredSnapshot | null> {
    return this.kv.get<StoredSnapshot>(SNAPSHOT_KEY);
  }

  private async waitForSnapshot(
    timeoutMs: number,
  ): Promise<MenuSnapshot | null> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      const stored = await this.readStored();
      if (stored?.snapshot) return stored.snapshot;
    }
    return null;
  }

  private async fetchAndStore(): Promise<MenuSnapshot> {
    const fetched = await this.sessionManager.runWithSession(this.fetchMenu);
    await this.kv.set(SNAPSHOT_KEY, {
      snapshot: fetched,
      storedAt: new Date().toISOString(),
    });
    logEvent("menu.fetch.success", { meals: fetched.meals.length });
    return fetched;
  }
}

function freshBase(stored: StoredSnapshot): number {
  return Math.max(Date.parse(stored.storedAt), Date.parse(stored.snapshot.updatedAt));
}
