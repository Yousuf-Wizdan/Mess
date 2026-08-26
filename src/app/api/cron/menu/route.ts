import { createMenuService } from "@/lib/app-context";
import { logEvent } from "@/lib/log";
import { requireCronSecret } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  if (!requireCronSecret(request)) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const snapshot = await createMenuService().refresh();
  logEvent("cron.menu.done", { ok: snapshot !== null });
  return Response.json({ success: snapshot !== null });
}

export async function POST(request: Request): Promise<Response> {
  return GET(request);
}
