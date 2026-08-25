# Bennett Mess

Today's mess menu for Bennett University, synced automatically from Camu.
Visitors just open the site — the server maintains the hosteller's Camu session
and refreshes the daily menu on schedule. No logins, no manual steps.

## Features

- Meal cards for Breakfast / Lunch / Snack / Dinner with dishes, calorie
  badges, timings, facility, and serve status
- "Now serving" emphasis for the current meal window (IST)
- Always renders the last-known-good snapshot; stale banner when Camu is down
- Live / Stale status pill and manual refresh
- Fully automatic: auto-login, session auto-refresh, daily 00:05 IST fetch
- Credentials and session material live only on the server (encrypted at rest)

## Setup (from a hosteller login)

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a free [Upstash](https://console.upstash.com) Redis database and copy
   its REST URL + token.

3. Copy `.env.example` to `.env.local` and fill in:

   | Variable | Purpose |
   | --- | --- |
   | `CAMU_EMAIL` / `CAMU_PASSWORD` | Hosteller login used by the server to auto-login |
   | `CAMU_INSTITUTION_ID` | Bennett institution id from Camu |
   | `SESSION_ENCRYPTION_KEY` | Long random string; encrypts the stored session |
   | `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Upstash REST credentials |
   | `CRON_SECRET` | Bearer token required by the cron endpoints |

   The Camu JWT / api-key / cookie are **not** configured manually — the app
   obtains them via auto-login and persists them encrypted in Redis.

4. Run:

   ```bash
   npm run dev
   ```

Open http://localhost:3000 — the first load performs an immediate fetch
(cold-boot behavior). Subsequent loads serve the stored snapshot.

## How the automation works

- **Lazy validation** — every menu request validates the cached session first;
   a Camu 401 triggers instant re-login and one retry.
- **Hourly backstop** — keeps the session warm even with no visitors.
- **Daily menu fetch** — at ~00:05 IST a cron endpoint refetches and stores the
  published day.
- **Failure handling** — exponential-backoff retries; visitors always get the
  last-good snapshot with a stale indicator.

### Keeping the cron running (deployment note)

Vercel Hobby's built-in cron is limited to once per day, so use a free external
scheduler (e.g. [cron-job.org](https://cron-job.org) or Upstash QStash):

| Job | Schedule (IST) | Method + URL | Header |
| --- | --- | --- | --- |
| Daily menu | `5 0 * * *` | `POST https://<your-app>/api/cron/menu` | `Authorization: Bearer $CRON_SECRET` |
| Session backstop | `0 * * * *` | `POST https://<your-app>/api/cron/session` | `Authorization: Bearer $CRON_SECRET` |

Both endpoints are idempotent and safe under concurrent invocations.

## Deployment (Vercel)

1. Push this repo to GitHub and import it in Vercel.
2. Add every variable from `.env.example` in Project → Settings → Environment
   Variables.
3. Deploy, then register the two scheduler jobs above against the production
   URL.

## Privacy notes

- The app auto-uses a hosteller account specifically authorized by its owner.
- Credentials never reach the browser or the repository; the stored session is
  encrypted at rest (AES-256-GCM).
- Only the currently published day can be shown; the UI labels it as today's
  menu.

## Development

```bash
npm run dev        # start dev server
npm run build      # production build
npm test           # vitest suite
npx tsc --noEmit   # typecheck
```
