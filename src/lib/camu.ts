import { logEvent } from "@/lib/log";
import {
  CamuAuthError,
  CamuTransientError,
  withRetry,
} from "@/lib/retry";
import { HostellerSession } from "@/lib/session";
import type { CamuMenuResponse } from "@/types/camu";

export interface CamuCredentials {
  Email: string;
  pwd: string;
  InId: string;
}

const DEFAULT_TIMEOUT_MS = 15_000;

export class CamuClient {
  constructor(
    private readonly baseUrl: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async login(credentials: CamuCredentials): Promise<HostellerSession> {
    return withRetry(async () => {
      const cookies = await this.warmUpCookies();
      const response = await this.fetchImpl(`${this.baseUrl}/login/validate`, {
        method: "POST",
        headers: this.baseHeaders(cookies),
        body: JSON.stringify({
          InId: credentials.InId,
          Email: credentials.Email,
          pwd: credentials.pwd,
        }),
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      });
      if (response.status === 401 || response.status === 403) {
        throw new CamuAuthError("Login rejected by Camu");
      }
      await ensureOk(response, "login");
      const payload = (await response.json().catch(() => null)) as LoginPayload | null;
      const data = payload?.output?.data;
      if (
        !data ||
        typeof data !== "object" ||
        !("logindetails" in data) ||
        data.logindetails == null
      ) {
        const message =
          data && "message" in data && typeof data.message === "string"
            ? data.message
            : "Login failed";
        logEvent("camu.login.rejected", {});
        throw new CamuAuthError(message);
      }
      const cookie = extractSessionCookie(
        response.headers.get("set-cookie"),
        "connect.sid",
      );
      if (!cookie) {
        throw new CamuTransientError("Login succeeded but no session cookie was issued");
      }
      logEvent("camu.login.success", {});
      return {
        cookie,
        jwt: "",
        apiKey: "",
        createdAt: new Date().toISOString(),
      };
    });
  }

  async validateSession(session: HostellerSession): Promise<boolean> {
    try {
      const response = await withRetry(() =>
        this.request("GET", "/api/sessionvalidate", session),
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
        "/api/mess-management/get-student-menu-list",
        session,
        {},
      );
      if (res.status === 401 || res.status === 403) {
        throw new CamuAuthError();
      }
      await ensureOk(res, "get-menu");
      return res;
    });
    return (await response.json()) as CamuMenuResponse;
  }

  private async warmUpCookies(): Promise<string> {
    try {
      const response = await this.fetchImpl(`${this.baseUrl}/`, {
        headers: baseStaticHeaders(),
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      });
      return normalizeCookies(response.headers.get("set-cookie"));
    } catch {
      return "";
    }
  }

  private request(
    method: "GET" | "POST",
    path: string,
    session: HostellerSession,
    body?: unknown,
  ): Promise<Response> {
    const headers: Record<string, string> = {
      ...this.baseHeaders(session.cookie),
      ...(session.jwt ? { Authorization: `Bearer ${session.jwt}` } : {}),
      ...(session.apiKey ? { "api-key": session.apiKey } : {}),
    };
    return this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });
  }

  private baseHeaders(cookie: string): Record<string, string> {
    return {
      ...baseStaticHeaders(),
      ...(cookie ? { Cookie: cookie } : {}),
    };
  }
}

function baseStaticHeaders(): Record<string, string> {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    appVersion: "v2",
    clientTzOfst: "-330",
    "X-App-Type": "student",
  };
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

function normalizeCookies(setCookie: string | null): string {
  if (!setCookie) return "";
  return setCookie
    .split(/,(?=[^;]+?=)/)
    .map((c) => c.split(";")[0].trim())
    .filter(Boolean)
    .join("; ");
}

function extractSessionCookie(setCookie: string | null, name: string): string {
  if (!setCookie) return "";
  for (const part of setCookie.split(/,(?=[^;]+?=)/)) {
    const pair = part.split(";")[0]?.trim();
    if (pair?.startsWith(`${name}=`)) return pair;
  }
  return "";
}

interface LoginPayload {
  output?: {
    data?: {
      logindetails?: unknown;
      message?: string;
      code?: string;
    } | null;
    errors?: unknown;
  };
}
