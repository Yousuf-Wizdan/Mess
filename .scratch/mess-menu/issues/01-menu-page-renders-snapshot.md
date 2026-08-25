# 01: Menu page renders a Menu Snapshot

**What to build:** Visiting the site shows the complete polished menu UI — navbar with app name, Bennett badge, IST day/date and status pill; a responsive meal-card grid (1/2/4 columns) where each Meal Period card shows its time range, facility accent color, serve-status chip, "Now serving" emphasis for the current window, dish rows with optional kcal badges — plus skeleton loading, empty state, stale banner, and unconfigured-session states. All rendered from a checked-in Menu Snapshot fixture so the full visual experience is demoable with zero backend.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] App scaffolded: Next.js App Router + TypeScript strict + Tailwind + shadcn/ui, `npm run dev` works
- [ ] Domain types defined strictly: MenuSnapshot, MealPeriod, Dish, API response shapes
- [ ] Page renders the fixture as ordered meal cards (Breakfast→Lunch→Snack→Dinner) in responsive grid
- [ ] Dish lines parsed into name + optional kcal badge; `mealClr` used as card accent
- [ ] Current Meal Period emphasized via parsed `mealTm` windows; others show Upcoming/Served chip from `srvSts`
- [ ] Skeleton, empty state, stale banner, and no-session-configured states implemented and reachable
- [ ] Navbar shows day/date in IST and a Live/Stale pill (fixture-driven)
