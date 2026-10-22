# Draft Pro statusCode sweep

**Status:** Implemented within assigned ownership.

The three remaining duck-typed API catches now trust only `DraftProRequestError`:

- `web/pages/api/v1/draft-pro/dust.ts` keeps authored 400 season mismatch, 403 capability denial, 429 rate limit, and 503 schedule-unavailable behavior. The DUST season and rate-limit helpers now create branded errors; retry headers remain intact.
- `web/pages/api/v1/draft-pro/export.ts` and `recommendations.ts` return their fixed generic 500 response for untrusted dependency errors, even when they carry numeric, string, or out-of-range `statusCode`, backend code, and private message text. Authored 403 capability denials remain intact.
- Extended the existing DUST, export, and recommendations API tests. Backend error probes cover 403, 503, 700, and string `"403"`; DUST also checks the 429 `Retry-After` header.

**Verification:** Focused Vitest passed: 3 files, 37 tests. Ran with the required no-network preload and Node v22.11.0 (`/usr/local/bin/node`; the suggested `/usr/local/bin/node22.11.0` executable is absent). Scoped `git diff --check` passed. No full suite or type-check was run.

**Audit boundary:** The Draft Pro routes under `/api/v1/draft-pro/` now have no duck-typed status extraction. `web/lib/draft-pro/account/refunds.ts` still sets plain authored status errors, and its consumer `web/pages/api/v1/account/draft-pro/refund-requests.ts` still duck-types `statusCode` and forwards messages for 404/422. That API route is outside the assigned write paths, so this sweep did not modify it; it remains a separate follow-up risk. `reports.ts` creates branded request errors.

Worker settings were verified by Chef for thread `01a15a0e-7cd4-7b01-a4ba-47715e40d815`: `gpt-6-luna`, low effort.
