import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CamuClient } from "@/lib/camu";
import { mapCamuMenu } from "@/lib/camu-map";
import { InMemoryKv } from "@/lib/kv-memory";
import { EMPTY_MENU_MESSAGE } from "@/types/menu";
import type { MenuSnapshot } from "@/types/menu";
import { MenuService } from "@/lib/menu-service";
import { InMemorySessionStore, SessionManager } from "@/lib/session";
import {
  FakeCamu,
  VALID_MENU_RESPONSE,
    jsonResponse,
} from "./fake-camu";

const CREDS = {
  Email: "h@bennett.edu",
  pwd: "pw",
  InId: "bennett",
};

let camu: FakeCamu;
let baseUrl: string;

beforeEach(async () => {
  camu = new FakeCamu();
  baseUrl = await camu.start();
  process.env.CAMU_EMAIL = CREDS.Email;
  process.env.CAMU_PASSWORD = CREDS.pwd;
  process.env.CAMU_INSTITUTION_ID = CREDS.InId;
});

afterEach(async () => {
  await camu.stop();
  delete process.env.CAMU_EMAIL;
  delete process.env.CAMU_PASSWORD;
  delete process.env.CAMU_INSTITUTION_ID;
});

function wire() {
  const kv = new InMemoryKv();
  const client = new CamuClient(baseUrl);
  const sessions = new SessionManager(
    client,
    CREDS,
    new InMemorySessionStore(),
  );
  const service = new MenuService(kv, sessions, async (session) =>
    mapCamuMenu(await client.getMenu(session)),
  );
  return { kv, client, service };
}

function loginHandler(): void {
  camu.on("/login/validate", (_req, res) => {
    jsonResponse(res, 200, { output: { data: { logindetails: {} } } }, {
      "Set-Cookie": "connect.sid=s%3As1; Path=/",
    });
  });
}

function menuHandler(statusForFirst?: number): void {
  let calls = 0;
  camu.on("/api/mess-management/get-student-menu-list", (_req, res) => {
    calls += 1;
    if (statusForFirst !== undefined && calls === 1) {
      jsonResponse(res, statusForFirst, {});
    } else {
      jsonResponse(res, 200, VALID_MENU_RESPONSE);
    }
  });
}

function makeSnapshot(updatedAt: Date) {
  return mapCamuMenu(VALID_MENU_RESPONSE, updatedAt);
}

async function seedSnapshot(
  kv: InMemoryKv,
  ageHours: number,
): Promise<void> {
  await kv.set("mess:snapshot", {
    snapshot: makeSnapshot(new Date(Date.now() - ageHours * 3_600_000)),
    storedAt: new Date(Date.now() - ageHours * 3_600_000).toISOString(),
  });
}

describe("MenuService", () => {
  it("returns the unconfigured error when env vars are missing", async () => {
    delete process.env.CAMU_EMAIL;
    const { service } = wire();

    const response = await service.getSnapshot();

    expect(response).toMatchObject({
      success: false,
      error: expect.stringMatching(/not configured/i),
    });
    expect(camu.callsTo("/login/validate")).toBe(0);
  });

  it("cold boots: no snapshot means a synchronous fetch serves fresh data", async () => {
    loginHandler();
    menuHandler();
    const { service } = wire();

    const response = await service.getSnapshot();

    expect(response.success).toBe(true);
    if (response.success) {
      expect(response.stale).toBe(false);
      expect(response.data.meals.map((m) => m.name)).toEqual(["Breakfast"]);
    }
  });

  it("serves a fresh stored snapshot and skips live fetching", async () => {
    const { kv, service } = wire();
    await seedSnapshot(kv, 1);

    const response = await service.getSnapshot();

    expect(response.success).toBe(true);
    expect(response.stale).toBe(false);
    expect(camu.callsTo("/login/validate")).toBe(0);
    expect(
      camu.callsTo("/api/mess-management/get-student-menu-list"),
    ).toBe(0);
  });

  it("marks old data stale and refreshes in the background while still serving", async () => {
    loginHandler();
    menuHandler();
    const { kv, service } = wire();
    await seedSnapshot(kv, 10);

    const response = await service.getSnapshot();

    expect(response.success).toBe(true);
    expect(response.stale).toBe(true);
    // background fetch is in flight; give it a beat
    await new Promise((r) => setTimeout(r, 50));
    expect(camu.callsTo("/api/mess-management/get-student-menu-list")).toBe(1);
  });

  it("keeps serving last-good data when Camu is down during a background refresh", async () => {
    const { kv, service } = wire();
    await seedSnapshot(kv, 10);
    camu.on("/login/validate", (_req, res) => {
      { res.statusCode = 500; res.end(); }
    });
    camu.on("/api/mess-management/get-student-menu-list", (_req, res) => {
      jsonResponse(res, 500, {});
    });

    const response = await service.getSnapshot();

    expect(response.success).toBe(true);
    expect(response.stale).toBe(true);
    if (response.success) {
      expect(response.data.meals.length).toBeGreaterThan(0);
    }
  }, 15_000);

  it("reports failure when there is no snapshot and the fetch fails", async () => {
    loginHandler();
    camu.on("/api/mess-management/get-student-menu-list", (_req, res) => {
      jsonResponse(res, 500, {});
    });
    const { service } = wire();

    const response = await service.getSnapshot();

    expect(response.success).toBe(false);
    expect(response.stale).toBe(true);
  }, 15_000);

  it("returns a clean empty signal when nothing is published", async () => {
    loginHandler();
    camu.on("/api/mess-management/get-student-menu-list", (_req, res) => {
      jsonResponse(res, 200, {
        output: { data: { facNme: "GF", curntDte: "2026-08-25T00:00:00Z", isAtve: false, oMealList: [] }, errors: null },
      });
    });
    const { service } = wire();

    const response = await service.getSnapshot();

    expect(response).toEqual({
      success: false,
      error: EMPTY_MENU_MESSAGE,
      code: "empty",
      stale: false,
    });
  });

  it("collapses concurrent requests behind the lock (stampede guard)", async () => {
    loginHandler();
    let menuCalls = 0;
    camu.on("/api/mess-management/get-student-menu-list", (_req, res) => {
      menuCalls += 1;
      setTimeout(() => jsonResponse(res, 200, VALID_MENU_RESPONSE), 40);
    });
    const { service } = wire();

    const [a, b] = await Promise.all([
      service.getSnapshot(),
      service.getSnapshot(),
    ]);

    expect(a.success).toBe(true);
    expect(b.success).toBe(true);
    expect(menuCalls).toBe(1);
  });

  it("force refresh refetches and returns fresh data synchronously", async () => {
    loginHandler();
    menuHandler();
    const { kv, service } = wire();
    await seedSnapshot(kv, 0.5);
    const storedBefore = await kv.get<{ snapshot: { updatedAt: string } }>(
      "mess:snapshot",
    );

    const response = await service.getSnapshot({ force: true });

    expect(response.success).toBe(true);
    if (response.success) {
      expect(response.data.updatedAt).not.toBe(
        storedBefore?.snapshot.updatedAt,
      );
      expect(response.stale).toBe(false);
    }
    expect(camu.callsTo("/login/validate")).toBe(1);
    expect(camu.callsTo("/api/mess-management/get-student-menu-list")).toBe(1);
  });

  it("refresh() returns the new snapshot for cron use", async () => {
    loginHandler();
    menuHandler();
    const { service } = wire();

    const snapshot = await service.refresh();

    expect(snapshot?.meals.length).toBeGreaterThan(0);
  });

  it("refresh() falls back to the stored snapshot when Camu fails", async () => {
    const { kv, service } = wire();
    await seedSnapshot(kv, 1);
    camu.on("/login/validate", (_req, res) => {
      { res.statusCode = 500; res.end(); }
    });
    camu.on("/api/mess-management/get-student-menu-list", (_req, res) => {
      jsonResponse(res, 500, {});
    });

    const snapshot = await service.refresh();

    expect(snapshot?.meals.length).toBeGreaterThan(0);
  }, 15_000);

  it("applies the enrichment hook to fetched snapshots before storing", async () => {
    loginHandler();
    menuHandler();
    const kv = new InMemoryKv();
    const client = new CamuClient(baseUrl);
    const sessions = new SessionManager(
      client,
      CREDS,
      new InMemorySessionStore(),
    );
    const enrich = async (snapshot: MenuSnapshot): Promise<MenuSnapshot> => ({
      ...snapshot,
      meals: snapshot.meals.map((meal) => ({
        ...meal,
        dishes: meal.dishes.map((dish) => ({
          ...dish,
          macros: { proteinG: 1, carbsG: 2, fatG: 3 },
          macroSource: "curated" as const,
        })),
      })),
    });
    const service = new MenuService(
      kv,
      sessions,
      async (session) => mapCamuMenu(await client.getMenu(session)),
      enrich,
    );

    const response = await service.getSnapshot();

    expect(response.success).toBe(true);
    if (response.success) {
      expect(response.data.meals[0].dishes[0].macroSource).toBe("curated");
    }
    const stored = await kv.get<{ snapshot: MenuSnapshot }>("mess:snapshot");
    expect(stored?.snapshot.meals[0].dishes[0].macros).toEqual({
      proteinG: 1,
      carbsG: 2,
      fatG: 3,
    });
  });
});
