# 02: Camu client + Hosteller Session lifecycle

**What to build:** A typed server-side Camu client that can log in with hosteller credentials, validate an existing session, transparently re-login on 401, and fetch the currently published menu day — with retry/exponential-backoff on transient failures and JSON logging that redacts all secrets. The Hosteller Session lifecycle owns credential→JWT/api-key/cookie exchange. Verified at the HTTP boundary against a scripted fake Camu server (menus, 401s, garbage, timeouts); no UI.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Typed Camu client exposes login, session validation, and menu fetch against the verified Camu contract
- [ ] Menu response parsed per data rules: newline-split Dishes, kcal badge extraction, meal ordering, current-day only
- [ ] Transient failures retried with exponential backoff; permanent failures surface typed errors
- [ ] All logs are structured JSON with JWT/api-key/password/cookie redacted
- [ ] Fake Camu HTTP server scripts success, 401-then-success, invalid-session, and timeout scenarios
- [ ] Tests cover: successful login+fetch, re-login-on-401, backoff on 5xx/timeout, parse of the documented response shape, empty-menu handling
