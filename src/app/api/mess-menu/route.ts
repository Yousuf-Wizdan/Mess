import { createMenuService } from "@/lib/app-context";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const force = new URL(request.url).searchParams.get("refresh") === "1";
  try {
    const response = await createMenuService().getSnapshot({ force });
    return Response.json(response, { status: response.success ? 200 : 503 });
  } catch {
    return Response.json(
      {
        success: false,
        error: "Unexpected server error while serving the menu",
        stale: true,
      },
      { status: 500 },
    );
  }
}
