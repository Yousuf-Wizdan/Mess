# ADR-0001: Upstash Redis for persistence instead of the serverless filesystem

## Status

Accepted

## Context

The app runs on Vercel's serverless platform (Hobby plan). The two pieces of
state — the encrypted Hosteller Session and the Menu Snapshot — must survive
cold boots, because the operational contract is "zero manual intervention":
if a cold boot lost the session, the app would have to re-login on every
invocation, and if it lost the snapshot, visitors would see an empty page.

The serverless filesystem is ephemeral and effectively read-only at runtime,
so neither `.env.local` rewrites nor local files can hold this state.

## Decision

Persist both blobs in Upstash Redis (free tier), accessed over its REST API:

- `mess:hosteller-session` — AES-256-GCM-encrypted session JSON
- `mess:snapshot` — the last-good Menu Snapshot with fetch metadata
- `mess:fetch-lock` — a short-TTL lock key (SET NX) guarding against
  request stampedes and concurrent cron invocations

Encryption uses `SESSION_ENCRYPTION_KEY` from the environment so a Redis
compromise yields no usable Camu credentials.

## Consequences

- One external dependency covers storage *and* distributed locking.
- Cold boots serve instantly from Redis; only a truly empty database triggers
  a synchronous first fetch.
- An extra vendor in the stack; acceptable at this scale since the free tier
  covers the entire workload.
