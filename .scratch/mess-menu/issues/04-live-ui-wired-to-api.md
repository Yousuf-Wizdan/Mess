# 04: Live UI wired to the API

**What to build:** The page stops using the fixture and consumes the real API: the status pill reflects actual Live/Stale/Offline state, manual refresh performs a live server-side fetch with toast feedback, the last-updated timestamp is real, and stale/empty/unconfigured states appear based on genuine responses. Demoable end-to-end on `npm run dev`.

**Blocked by:** 01 (Menu page renders a Menu Snapshot), 03 (Upstash Redis persistence + public menu API)

**Status:** ready-for-agent

- [ ] Page fetches from the mess-menu API route (server → own API, never browser→Camu)
- [ ] Status pill derives from response staleness/failure signals; offline detection handled
- [ ] Refresh button triggers live fetch, shows toast on update, disables while in flight
- [ ] Stale banner, empty state, and configure-session page render from real API responses
- [ ] Component tests updated to consume API-contract fixtures through the wired components
