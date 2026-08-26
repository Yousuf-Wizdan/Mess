# Context

Bennett Mess shows **Day Scholars** today's published mess menu, synced
automatically from the Camu ERP.

## Glossary

- **Day Scholar**
  A Bennett University student who lives off-campus and has no Camu access of
  their own. The primary audience: they cannot see the mess menu through Camu
  themselves, so the app publishes it for them. (The server still fetches data
  via one authorized hosteller account; that credential is infrastructure, not
  the audience.)

- **Hosteller Session**
  The server-held Camu session material (JWT, api-key, session cookie) obtained
  by logging in with the hosteller's credentials. Owned entirely by the server;
  encrypted at rest; never exposed to browsers. Refreshed lazily before use and
  proactively by the hourly backstop.

- **Menu Snapshot**
  The last successfully fetched rendering of one published day's menu (date,
  facility, meals, updatedAt). Persisted externally so every visitor sees
  last-known-good data even when Camu is unreachable. The UI always renders a
  snapshot; "today's menu" means the currently published day only — the Camu
  endpoint ignores date parameters and returns only the currently published day,
  so a calendar of future days is not available.

- **Meal Period**
  One serving window within a day (Breakfast, Lunch, Snack, Dinner) with a name,
  time range, facility, accent color, serve status, and ordered dish list.

- **Dish**
  A single food item parsed from Camu's newline-separated meal text, optionally
  carrying a calorie count.

- **Estimated Nutrition**
  Per-dish macronutrients (protein, carbs, fat) that Camu does not provide.
  Estimated from the dish name by an LLM and cached per dish so every visitor
  sees stable values. Hand-curated entries always override estimates. Estimates
  are always labeled as such and are never shown when unavailable — invented
  numbers are forbidden.

- **Live / Stale / Offline**
  The three trust states shown to visitors. *Live*: data is fresh. *Stale*:
  showing last-known-good data older than the freshness window or fetched while
  Camu is failing. *Offline*: no data could be served at all.

## Decisions

See `docs/adr/` for architecture decision records.
