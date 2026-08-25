# ADR-0002: Lazy session validation plus hourly backstop instead of fixed 5-minute polling

## Status

Accepted

## Context

The original design called for checking `/sessionvalidate` every ~5 minutes so
the Hosteller Session never lapses. On Vercel serverless that means ~288 paid
invocations per day doing nothing most of the time, and Vercel Hobby's built-in
cron cannot even express sub-daily schedules.

## Decision

Two mechanisms replace fixed polling:

1. **Lazy validation** — every menu fetch validates the cached session first;
   any Camu 401 triggers an immediate re-login and one retry of the operation.
   Visitors therefore never observe a dead session.
2. **Hourly backstop** — an external scheduler hits `/api/cron/session`
   hourly so the session stays warm even if nobody visits for days, and to
   surface login failures early.

Cron routes are guarded by a `CRON_SECRET` bearer token and are idempotent:
a Redis lock collapses concurrent or repeated invocations into one unit of work.

## Consequences

- Same reliability guarantee as fixed polling at ~24× fewer invocations.
- Depends on an external scheduler (cron-job.org / QStash) rather than Vercel
  Cron; documented in the README so deployers keep the cron alive.
- A visitor hitting the site during the rare window where the backstop failed
  and Camu expired the session still succeeds via lazy re-login — degraded
  latency only, never a failure.
