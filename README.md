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

   The Camu session (`connect.sid` cookie) is **not** configured manually —
   the app obtains it via auto-login and persists it encrypted in Redis.

4. Run:

   ```bash
   npm run dev
   ```

Open http://localhost:3000 — the first load performs an immediate fetch
(cold-boot behavior). Subsequent loads serve the stored snapshot.

## How the automation works

- **Login (v2 contract, verified against production)** — `POST /login/validate`
  on the student host with JSON body `{InId, Email, pwd}` and headers
  `appVersion: v2`, `clientTzOfst: -330`, `X-App-Type: student`. Success returns
  `output.data.logindetails` plus a `connect.sid` session cookie; failure
  returns `code: "INCRT_CRD"`.
- **Session validation** — `GET /api/sessionvalidate` with the session cookie;
  200 = valid, 401 = expired → instant re-login.
- **Menu** — `POST /api/mess-management/get-student-menu-list` with the session
  cookie (Authorization/api-key sent only if available). Body `{}` returns the
  currently published day.
- **Lazy validation** — every menu request validates the cached session first;
   a Camu 401 triggers instant re-login and one retry.
- **Hourly backstop** — keeps the session warm even with no visitors.
- **Daily menu fetch** — at ~00:05 IST a cron endpoint refetches and stores the
  published day.
- **Failure handling** — exponential-backoff retries; visitors always get the
  last-good snapshot with a stale indicator.

### Manual-session fallback

If auto-login is unavailable for your account, set `CAMU_SESSION_COOKIE` in the
environment (copy the full `Cookie` header from any logged-in Camu request in
your browser's DevTools Network tab). The app uses it directly and only falls
back to credential login when it expires. See `.env.example`.

### Keeping the cron running (deployment note)

A daily menu refresh is configured natively in [`vercel.json`](./vercel.json)
as a Vercel cron. The expression is `30 18 * * *`. Vercel cron runs in **UTC**
and on **Hobby** fires somewhere within the configured hour, so the effective
window for this job is roughly 18:30 UTC → ~00:00–00:59 IST the next morning,
right after the menu is published at midnight IST.
The same job re-validates/refreshes the Camu session before fetching, so it also
acts as the daily session backstop; no hourly cron is needed (Hobby allows only
one cron per project).

| Job | Schedule (UTC) | Cron endpoint |
| --- | --- | --- |
| Daily menu + session warm | `30 18 * * *` | `GET /api/cron/menu` |

Set the `CRON_SECRET` environment variable in Vercel; it is auto-sent as the
`Authorization: Bearer $CRON_SECRET` header, which the cron endpoint verifies.

The `/api/cron/session` endpoint still exists but is no longer scheduled; it can
be re-registered as a cron (or external scheduler) if true sub-daily warmth is
ever required.

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
