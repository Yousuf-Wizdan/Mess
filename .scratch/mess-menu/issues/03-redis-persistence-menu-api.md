# 03: Upstash Redis persistence + public menu API

**What to build:** The encrypted Hosteller Session and Menu Snapshot persist in Upstash Redis. The public `/api/mess-menu` route serves the full contract: lazy session validation before every fetch (instant re-login on 401), Redis lock against request stampedes, snapshot-with-staleness fallback when Camu is down, `{success, data, updatedAt, stale}` responses, and the unconfigured-session error shape. Tested end-to-end with fake Camu + in-memory Redis substitute; curl-demoable.

**Blocked by:** 02 (Camu client + session lifecycle)

**Status:** ready-for-agent

- [ ] Session store encrypts the full session blob (AES-256-GCM, key from env) before writing to Redis and decrypts on read
- [ ] Menu Snapshot persisted with updatedAt; missing/stale snapshots trigger background refetch behind a distributed lock
- [ ] Lazy validation runs before each menu fetch; any 401 triggers immediate re-login and one retry
- [ ] Route never throws to clients: degraded responses carry `stale:true` and last-good data
- [ ] In-flight promise dedupe prevents duplicate logins within one instance
- [ ] Seam tests cover: cold boot with no snapshot, healthy refresh path, Camu-down fallback to snapshot, concurrent request stampede, unconfigured env
