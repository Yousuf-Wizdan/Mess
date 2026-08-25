import { createMenuService } from "@/lib/app-context";
import { MenuPage } from "@/components/mess/menu-page";

export const dynamic = "force-dynamic";

export default async function Home() {
  const initial = await createMenuService().getSnapshot();
  return <MenuPage initial={initial} />;
}
