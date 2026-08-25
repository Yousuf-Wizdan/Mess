import { createMenuService } from "@/lib/app-context";
import { MENU_FIXTURE } from "@/lib/menu-fixture";
import { MenuPage } from "@/components/mess/menu-page";

export const dynamic = "force-dynamic";

export default async function Home() {
  const initial =
    process.env.DEMO_MODE === "1"
      ? {
          success: true as const,
          data: MENU_FIXTURE,
          updatedAt: MENU_FIXTURE.updatedAt,
          stale: false,
        }
      : await createMenuService().getSnapshot();
  return <MenuPage initial={initial} />;
}
