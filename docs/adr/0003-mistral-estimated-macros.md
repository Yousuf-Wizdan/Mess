# ADR-0003: Mistral-estimated macronutrients with curated overrides

## Status

Accepted

## Context

Day Scholars asked for per-meal nutrition beyond the calorie counts Camu
publishes. Camu's menu API provides only dish names and an optional calorie
count — protein, carbs, and fat do not exist anywhere in the source data, and
the university publishes no official macro tables.

The options were:

1. Hand-curate a mapping of every dish the mess serves.
2. Skip macros entirely and show calories only.
3. Estimate macros from dish names with an LLM.

Option 1 alone cannot keep up: the mess rotates dishes constantly, and gaps
would silently degrade the feature. Option 2 abandons the request.

## Decision

Hybrid estimation, resolved at fetch time (never on the request path):

- A hand-curated table (`nutrition-overrides.ts`) maps common recurring
  dishes to macros and always wins.
- Everything else is estimated by Mistral (`mistral-small-latest`, JSON
  response format) in one batched call per fetch, keyed by normalized dish
  name and cached in Redis for 30 days so every visitor sees stable values.
- Estimates are labeled as estimates in the UI ("est." badge). Dishes with no
  data show nothing at all — invented numbers are forbidden.

## Consequences

- Nutrition quality depends on LLM accuracy; acceptable because values are
  explicitly presented as estimates for informational use.
- One more external dependency (Mistral API key); without it, the app
  degrades gracefully to calorie-only display.
- Cached estimates can be stale if the mess changes recipes; the 30-day TTL
  and curated overrides bound the damage.
