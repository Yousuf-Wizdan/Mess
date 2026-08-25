import type { CamuMenuResponse } from "@/types/camu";
import { HostellerSession } from "@/lib/session";
import { logEvent } from "@/lib/log";
import {
  CamuAuthError,
  CamuTransientError,
  withRetry,
} from "@/lib/retry";

export interface CamuCredentials {
  email: string;
  password: string;
  institutionId: string;
}

const DEFAULT_TIMEOUT_MS = 15_000;

export class CamuClient {
  constructor(
    private readonly baseUrl: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async login(credentials: CamuCredentials): Promise<HostellerSession> {
    return withRetry(async () => {
      const response = await this.request("POST", "/login/validate", {
        body: {
          email: credentials.email,
          password: credentials.password,
          inId: credentials.institutionId,
        },
      });
      if (response.status === 401 || response.status === 403) {
        throw new CamuAuthError("Login rejected: invalid credentials");
      }
      await ensureOk(response, "login");
      const payload = (await response.json().catch(() => null)) as
        | Record<string, unknown>
        | null;
      const cookie = extractSessionCookie(response.headers.get("set-cookie"));
      const session = extractSession(payload, cookie);
      if (!session) {
        throw new CamuTransientError(
          "Login succeeded but no session material found in response",
        );
      }
      logEvent("camu.login.success", {});
      return session;
    });
  }

  async validateSession(session: HostellerSession): Promise<boolean> {
    try {
      const response = await withRetry(() =>
        this.request("GET", "/sessionvalidate", { session }),
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  async getMenu(session: HostellerSession): Promise<CamuMenuResponse> {
    const response = await withRetry(async () => {
      const res = await this.request(
        "POST",
        "/mess-management/get-student-menu-list",
        { session, body: {} },
      );
      if (res.status === 401 || res.status === 403) {
        throw new CamuAuthError();
      }
      await ensureOk(res, "get-menu");
      return res;
    });
    return (await response.json()) as CamuMenuResponse;
  }

  private request(
    method: "GET" | "POST",
    path: string,
    options: { session?: HostellerSession; body?: unknown } = {},
  ): Promise<Response> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      appVersion: "v2",
      clientTzOfst: "-330",
    };
    if (options.session) {
      headers.Authorization = `Bearer ${options.session.jwt}`;
      headers["api-key"] = options.session.apiKey;
      headers.Cookie = options.session.cookie;
    }
    return this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: method === "POST" ? JSON.stringify(options.body ?? {}) : undefined,
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });
  }
}

async function ensureOk(response: Response, action: string): Promise<void> {
  if (response.ok) return;
  if (response.status >= 500 || response.status === 429) {
    throw new CamuTransientError(`Camu ${action} failed`, response.status);
  }
  if (response.status === 401 || response.status === 403) {
    throw new CamuAuthError();
  }
  throw new Error(`Camu ${action} failed with status ${response.status}`);
}

function extractSessionCookie(setCookie: string | null): string {
  if (!setCookie) return "";
  const pair = setCookie.split(";")[0]?.trim();
  return pair ?? "";
}

function extractSession(
  payload: Record<string, unknown> | null,
  cookie: string,
): HostellerSession | null {
  const found: { jwt?: string; apiKey?: string } = {};
  walk(payload, (key, value) => {
    if (typeof value !== "string" || value.length === 0) return;
    const lower = key.toLowerCase();
    if (
      !found.jwt &&
      (lower === "jwt" ||
        lower.endsWith("token") ||
        lower === "access_token" ||
        lower === "jwttoken")
    ) {
      found.jwt = value;
    }
    if (!found.apiKey && (lower === "api-key" || lower === "apikey")) {
      found.apiKey = value;
    }
  });
  if (!found.jwt || !found.apiKey) return null;
  return {
    jwt: found.jwt,
    apiKey: found.apiKey,
    cookie,
    createdAt: new Date().toISOString(),
  };
}

function walk(
  node: unknown,
  visit: (key: string, value: unknown) => void,
  depth = 0,
): void {
  if (typeof node !== "object" || node === null || depth > 8) return;
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    visit(key, value);
    walk(value, visit, depth + 1);
  }
}
