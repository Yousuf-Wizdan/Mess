import { CAMU_BASE_URL, createKv, createSessionManager } from "@/lib/app-context";
import { CamuClient } from "@/lib/camu";
import { requireCronSecret } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";

const ENDPOINTS = [
  "/api/mess-management/get-student-menu-list",
  "/api/mess-management/get-menu-list",
  "/api/mess-management/get-mess-menu-list",
  "/api/mess-management/get-all-menu",
];

const BODIES = [
  { label: "empty", body: {} },
  { label: "date", body: { date: "2026-08-28" } },
  { label: "currentDate", body: { curntDte: "2026-08-28" } },
  { label: "fromDate", body: { fromDate: "2026-08-28", toDate: "2026-09-03" } },
];

async function withHeaders(
  base: Record<string, string>,
  cookie: string,
): Promise<Record<string, string>> {
  return { ...base, ...(cookie ? { Cookie: cookie } : {}) };
}

export async function GET(request: Request): Promise<Response> {
  if (!requireCronSecret(request)) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const kv = createKv();
  const sessionManager = createSessionManager(kv);
  const results: unknown[] = [];

  try {
    const session = await sessionManager.getValidSession();
    const client = new CamuClient(CAMU_BASE_URL);

    for (const endpoint of ENDPOINTS) {
      for (const { label, body } of BODIES) {
        const headers = await withHeaders(
          {
            Accept: "application/json",
            "Content-Type": "application/json",
            appVersion: "v2",
            clientTzOfst: "-330",
            "X-App-Type": "student",
            ...(session.jwt ? { Authorization: `Bearer ${session.jwt}` } : {}),
            ...(session.apiKey ? { "api-key": session.apiKey } : {}),
          },
          session.cookie,
        );

        const probe = await fetch(`${CAMU_BASE_URL}${endpoint}`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(20_000),
        });

        const text = await probe.text();
        results.push({
          endpoint,
          variant: label,
          status: probe.status,
          preview: text.slice(0, 500),
        });
      }
    }
  } catch (error) {
    results.push({
      fatal: true,
      message: error instanceof Error ? error.message : String(error),
    });
  }

  return Response.json({ probedAt: new Date().toISOString(), results });
}