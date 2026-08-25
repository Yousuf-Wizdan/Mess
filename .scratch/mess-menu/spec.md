# Spec: Bennett Mess — automatic mess menu web app

**Status:** ready-for-agent

## Problem Statement

A Bennett University hosteller who wants to check today's mess menu has to log in to Camu whenever its session expires, navigate a clunky ERP interface, and has no way to see the menu when offline or when Camu is slow/down. Checking what's for dinner takes more effort than it should.

## Solution

A public website that always shows today's published mess menu. A server-side worker maintains the hosteller's Camu session automatically (auto-login, auto-refresh before expiry) and fetches the menu daily on schedule. Visitors always see the last-known-good Menu Snapshot, even when Camu is unreachable. Credentials never leave the server.

## User Stories

1. As a visitor, I want to see today's mess menu immediately on page load, so that I don't have to log into Camu.
2. As a visitor, I want one card per Meal Period (Breakfast, Lunch, Snack, Dinner), so that I can scan the day at a glance.
3. As a visitor, I want each Dish listed with an optional calorie badge, so that I can watch my intake.
4. As a visitor, I want each card to show the meal time range and facility, so that I know where and when to eat.
5. As a visitor, I want the meal currently being served emphasized ("Now serving"), so that I instantly see what's available right now.
6. As a visitor, I want a serve-status chip (Upcoming / Served) per Meal Period, so that I know if I missed a meal.
7. As a visitor, I want the menu's own day/date shown, so that I trust it is today's menu.
8. As a visitor, I want a last-updated timestamp, so that I know how fresh the data is.
9. As a visitor, I want a Live/Stale/Offline status pill, so that I know whether to trust what I'm reading.
10. As a visitor, I want a manual refresh button, so that I can force a fetch without waiting for the schedule.
11. As a visitor, I want a stale banner ("showing last available menu") when live fetching fails, so that I'm never misled.
12. As a visitor, I want a clean empty state when no menu is published, so that I understand nothing is wrong.
13. As a visitor, I want skeleton loading states, so that the app feels responsive.
14. As a mobile user, I want a responsive 1/2/4-column layout, so that the menu is readable on any device.
15. As an operator, I want everything configured via server env vars, so that no credentials ever exist in code.
16. As an operator, I want the Hosteller Session auto-created on boot and auto-refreshed before expiry, so that there is never a human re-login step.
17. As an operator, I want the session validated lazily before every menu fetch with instant re-login on 401, so that visitors never hit a dead session.
18. As an operator, I want an hourly session backstop job, so that the session stays warm even when nobody visits.
19. As an operator, I want a daily 00:05 IST menu fetch job, so that the snapshot is fresh each morning.
20. As an operator, I want the snapshot persisted externally, so that cold boots never show an empty site.
21. As an operator, I want cron endpoints idempotent and concurrency-safe, so that duplicate scheduler hits cause no harm.
22. As an operator, I want failed fetches retried with exponential backoff and errors logged with secrets redacted, so that debugging is safe.
23. As an operator, I want the stored Hosteller Session encrypted at rest, so that a Redis breach exposes no usable credentials.
24. As an operator, I want all Camu traffic proxied through my server, so that credentials/JWT/api-key/cookie never reach the browser.
25. As an operator, I want a clear "configure the hosteller session" state instead of a crash when env is missing, so that misconfiguration is obvious.
26. As an operator, I want to deploy free (Vercel Hobby + external scheduler + Upstash free tier), so that running costs are zero.

## Implementation Decisions

- **Stack**: Next.js App Router, TypeScript strict (no `any`), Tailwind, shadcn/ui, Lucide icons, `date-fns`.
- **Deployment**: Vercel Hobby; public read-only UI; single tenant (one hosteller).
- **Persistence**: Upstash Redis holds both the AES-256-GCM-encrypted Hosteller Session (`SESSION_ENCRYPTION_KEY`) and the Menu Snapshot JSON; Redis also provides the distributed stampede lock. (ADR-0001)
- **Session upkeep**: lazy validation before every menu fetch; any Camu 401 triggers immediate re-login; hourly backstop cron keeps the session warm. (ADR-0002)
- **Menu fetch**: external scheduler (cron-job.org/QStash) hits protected cron routes daily at 00:05 IST; missing/stale snapshot triggers immediate background fetch; write-through on success.
- **Camu contract** (verified): `POST /login/validate` for login; `/sessionvalidate` to check; `POST /mess-management/get-student-menu-list` with `Authorization: Bearer <jwt>`, `api-key`, `appVersion: v2`, `clientTzOfst: -330`, session cookie. Body `{}` returns the currently published day only.
- **Data rules**: split `msNme` on newlines into Dishes, strip trailing `(NNN Kcal)` into a calorie badge; order Breakfast→Lunch→Snack→Dinner; empty `oMealList`/`isAtive:false` = clean empty state; show day/date from `curntDte`. No future-date feature.
- **API contract**: `mess-menu` route returns `{success, data, updatedAt, stale}` or `{success:false, error, stale}`; cron routes guarded by `CRON_SECRET` header; IST hardcoded everywhere.
- **UI**: navbar (app name "Bennett Mess", Bennett badge, IST day/date, status pill, refresh button); meal cards with accent from `mealClr`; serve-status chip derived from `srvSts`.

## Testing Decisions

- Tests assert **external behavior only** (HTTP responses, rendered DOM) — never internal function calls.
- **Seam 1 (primary)**: route handlers exercised against a scripted **fake Camu HTTP server** (injected via base-URL env) plus an **in-memory Redis substitute**, covering login/re-login/backoff/snapshot/staleness/lock end-to-end.
- **Seam 2**: UI components fed API-contract fixtures directly, asserting rendered output for every visual state.
- No prior art (greenfield); Vitest chosen as runner.

## Out of Scope

Future-date/calendar menus (Camu publishes current day only) · multi-user accounts · visitor authentication · native apps · meal booking/preferences/feedback.

## Further Notes

First implementation seeds domain docs: glossary (*Hosteller Session*, *Menu Snapshot*, *Meal Period*, *Dish*, *Live/Stale/Offline*) and ADRs for Upstash-over-serverless-FS persistence and lazy-validate-over-fixed-polling. This app auto-uses a hosteller account authorized by its owner; credentials stay server-side and out of the repo.
