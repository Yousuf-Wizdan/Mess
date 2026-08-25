import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CamuAuthError,
} from "@/lib/retry";
import { CamuClient } from "@/lib/camu";
import {
  InMemorySessionStore,
  SessionManager,
} from "@/lib/session";
import { mapCamuMenu } from "@/lib/camu-map";
import { logEvent } from "@/lib/log";
import {
  FakeCamu,
  VALID_MENU_RESPONSE,
  VALID_SESSION_RESPONSE,
  jsonResponse,
} from "./fake-camu";

const CREDS = {
  email: "hosteller@bennett.edu",
  password: "hunter2",
  institutionId: "bennett",
};

let camu: FakeCamu;
let baseUrl: string;

beforeEach(async () => {
  camu = new FakeCamu();
  baseUrl = await camu.start();
});

afterEach(async () => {
  await camu.stop();
});

function newClient(): CamuClient {
  return new CamuClient(baseUrl);
}

describe("CamuClient", () => {
  it("logs in and extracts jwt, api-key and cookie", async () => {
    camu.on("/login/validate", (_req, res) => {
      jsonResponse(res, 200, VALID_SESSION_RESPONSE, {
        "Set-Cookie": "SESSIONID=abc123; Path=/; HttpOnly",
      });
    });

    const session = await newClient().login(CREDS);

    expect(session.jwt).toBe("test-jwt-token");
    expect(session.apiKey).toBe("test-api-key");
    expect(session.cookie).toBe("SESSIONID=abc123");
  });

  it("sends menu request with auth headers per the Camu contract", async () => {
    const session = {
      jwt: "jwt-1",
      apiKey: "key-1",
      cookie: "SESSIONID=xyz",
      createdAt: new Date().toISOString(),
    };
    camu.on("/mess-management/get-student-menu-list", (req, res) => {
      jsonResponse(res, 200, VALID_MENU_RESPONSE);
    });

    const menu = await newClient().getMenu(session);

    expect(menu.output.data?.facNme).toBe("Ground Floor");
    const sent = camu.requests.at(-1)!;
    expect(sent.headers["authorization"]).toBe("Bearer jwt-1");
    expect(sent.headers["api-key"]).toBe("key-1");
    expect(sent.headers["cookie"]).toBe("SESSIONID=xyz");
    expect(sent.headers["appversion"]).toBe("v2");
    expect(sent.headers["clienttzofst"]).toBe("-330");
    expect(JSON.parse(sent.body)).toEqual({});
  });

  it("retries transient 5xx with backoff then succeeds", async () => {
    let calls = 0;
    camu.on("/mess-management/get-student-menu-list", (_req, res) => {
      calls += 1;
      if (calls < 3) {
        jsonResponse(res, 502, { error: "bad gateway" });
      } else {
        jsonResponse(res, 200, VALID_MENU_RESPONSE);
      }
    });
    const session = makeSession();

    const menu = await newClient().getMenu(session);

    expect(menu.output.data?.isAtve).toBe(true);
    expect(calls).toBe(3);
  }, 10_000);

  it("gives up after exhausting retries on persistent 5xx", async () => {
    camu.on("/mess-management/get-student-menu-list", (_req, res) => {
      jsonResponse(res, 500, { error: "boom" });
    });

    await expect(newClient().getMenu(makeSession())).rejects.toMatchObject({
      name: "CamuTransientError",
    });
    expect(camu.callsTo("/mess-management/get-student-menu-list")).toBeGreaterThanOrEqual(
      4,
    );
  }, 15_000);

  it("raises auth error without retrying on 401", async () => {
    camu.on("/mess-management/get-student-menu-list", (_req, res) => {
      jsonResponse(res, 401, { error: "unauthorized" });
    });

    await expect(newClient().getMenu(makeSession())).rejects.toBeInstanceOf(
      CamuAuthError,
    );
    expect(camu.callsTo("/mess-management/get-student-menu-list")).toBe(1);
  });

  it("validateSession reports false when endpoint fails", async () => {
    camu.on("/sessionvalidate", (_req, res) => {
      res.statusCode = 401;
      res.end();
    });

    const valid = await newClient().validateSession(makeSession());

    expect(valid).toBe(false);
  });
});

describe("SessionManager", () => {
  function loginHappyPath(): void {
    camu.on("/login/validate", (_req, res) => {
      jsonResponse(res, 200, VALID_SESSION_RESPONSE, {
        "Set-Cookie": "SESSIONID=fresh; Path=/",
      });
    });
  }

  function validateOk(ok: boolean): void {
    camu.on("/sessionvalidate", (_req, res) => {
      if (ok) jsonResponse(res, 200, { valid: true });
      else {
        res.statusCode = 401;
        res.end();
      }
    });
  }

  it("performs lazy re-login when stored session is invalid", async () => {
    const store = new InMemorySessionStore();
    await store.set(makeSession());
    loginHappyPath();
    validateOk(false);

    const manager = new SessionManager(newClient(), CREDS, store);
    const session = await manager.runWithSession(async (s) => s.jwt);

    expect(session).toBe("test-jwt-token");
    expect(camu.callsTo("/login/validate")).toBe(1);
  });

  it("reuses a still-valid session without logging in again", async () => {
    const store = new InMemorySessionStore();
    await store.set(makeSession());
    validateOk(true);

    const manager = new SessionManager(newClient(), CREDS, store);
    await manager.runWithSession(async (s) => s.jwt);

    expect(camu.callsTo("/login/validate")).toBe(0);
  });

  it("recovers once from a mid-request 401 and retries the operation", async () => {
    const store = new InMemorySessionStore();
    await store.set(makeSession());
    loginHappyPath();
    validateOk(true);
    let menuCalls = 0;
    camu.on("/mess-management/get-student-menu-list", (_req, res) => {
      menuCalls += 1;
      if (menuCalls === 1) jsonResponse(res, 401, {});
      else jsonResponse(res, 200, VALID_MENU_RESPONSE);
    });

    const manager = new SessionManager(newClient(), CREDS, store);
    const result = await manager.runWithSession((s) =>
      newClient().getMenu(s),
    );

    expect(result.output.data?.oMealList).toHaveLength(1);
    expect(menuCalls).toBe(2);
    expect(camu.callsTo("/login/validate")).toBe(1);
  });

  it("does not stack parallel logins (single-flight)", async () => {
    loginHappyPath();
    validateOk(false);
    // slow the fake login slightly so two callers overlap
    camu.on("/login/validate", (_req, res) => {
      setTimeout(() => jsonResponse(res, 200, VALID_SESSION_RESPONSE), 30);
    });

    const manager = new SessionManager(newClient(), CREDS, new InMemorySessionStore());
    await Promise.all([
      manager.getValidSession(),
      manager.getValidSession(),
    ]);

    expect(camu.callsTo("/login/validate")).toBe(1);
  });
});

describe("menu mapping", () => {
  it("maps the documented Camu response into a MenuSnapshot", () => {
    const snapshot = mapCamuMenu(VALID_MENU_RESPONSE, new Date("2026-08-25T04:35:00Z"));

    expect(snapshot.facility).toBe("Ground Floor");
    const breakfast = snapshot.meals[0];
    expect(breakfast.name).toBe("Breakfast");
    expect(breakfast.dishes[0]).toEqual({ name: "Besan Chilla", kcal: 180 });
    expect(breakfast.dishes[1]).toEqual({ name: "Green Chutney" });
    expect(breakfast.window).toEqual({ startMinutes: 450, endMinutes: 570 });
  });

  it("throws EmptyMenuError for inactive or empty menus", () => {
    const empty = {
      output: { data: { isAtve: false, oMealList: [] }, errors: null },
    };
    expect(() => mapCamuMenu(empty as never)).toThrowError(/published/i);
  });
});

describe("logging", () => {
  it("redacts secret-bearing fields", () => {
    const lines: string[] = [];
    const original = console.log;
    console.log = (msg: string) => lines.push(msg);
    try {
      logEvent("test.event", {
        password: "hunter2",
        jwt: "tok",
        apiKey: "key",
        Cookie: "sid=1",
        safe: "value",
      });
    } finally {
      console.log = original;
    }
    const parsed = JSON.parse(lines[0]);
    expect(parsed.password).toBe("[REDACTED]");
    expect(parsed.jwt).toBe("[REDACTED]");
    expect(parsed.apiKey).toBe("[REDACTED]");
    expect(parsed.Cookie).toBe("[REDACTED]");
    expect(parsed.safe).toBe("value");
  });
});

function makeSession() {
  return {
    jwt: "jwt-1",
    apiKey: "key-1",
    cookie: "SESSIONID=old",
    createdAt: new Date().toISOString(),
  };
}
