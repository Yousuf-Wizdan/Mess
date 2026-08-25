# 05: Cron automation

**What to build:** Idempotent cron endpoints keep everything fresh without human intervention: a daily 00:05 IST menu fetch and an hourly Hosteller Session backstop, both guarded by a shared secret header, both safe under concurrent/multi-instance invocation. A missing snapshot on cold boot triggers an immediate fetch. README documents external scheduler setup (cron-job.org or QStash) since Vercel Hobby cron is daily-only.

**Blocked by:** 03 (Upstash Redis persistence + public menu API)

**Status:** ready-for-agent

- [ ] Daily menu cron endpoint fetches and write-through stores a fresh Menu Snapshot
- [ ] Hourly session cron validates and refreshes the Hosteller Session proactively
- [ ] Both endpoints require the secret header and reject unauthorized calls
- [ ] Both are idempotent: repeated/concurrent invocations produce no duplicate work (lock held)
- [ ] Cold-boot immediate fetch covered by seam tests (no snapshot ⇒ fetch on first hit)
- [ ] README documents scheduler URLs, headers, schedule expressions, and Vercel-cron alternative
