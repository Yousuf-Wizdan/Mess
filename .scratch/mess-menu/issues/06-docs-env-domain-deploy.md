# 06: Docs, env hygiene, domain docs, deploy verification

**What to build:** The repo ships complete and honest: `.env.example` documenting every variable (no real values), a README covering hosteller setup → local run → Vercel deploy with cron kept alive, seeded domain docs (glossary plus ADRs for Redis-over-serverless-FS persistence and lazy-validate-over-fixed-polling), and a final green strict build with degraded paths exercised one last time.

**Blocked by:** 04 (Live UI wired to the API), 05 (Cron automation)

**Status:** ready-for-agent

- [ ] Env example lists all runtime vars with placeholder values and comments; repo contains no real credentials
- [ ] README: setup from a hosteller login, how auto-refresh/daily fetch works, deployment notes
- [ ] CONTEXT.md glossary seeded: Hosteller Session, Menu Snapshot, Meal Period, Dish, Live/Stale/Offline
- [ ] ADR-0001 (Upstash Redis over serverless FS) and ADR-0002 (lazy validate + hourly backstop over fixed polling) recorded
- [ ] Strict typecheck and production build pass clean
