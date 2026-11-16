# RSO Judd Caulfield bug

- Scope: investigate user-supplied screenshot, fix and test local RSO issue. No production writes or release authorized.
- Checkout: canonical `/Users/tim/Code/fhfhockey.com`, `octoberBranch`; preserve concurrent DRM and other changes.
- Start: attached Mac; read repository instructions. Screenshot Library materialization failed through current helper and one fresh retry; parent asked to inspect available attachment.
- Next: identify exact reported symptom, trace relevant RSO identity/roster flow, add regression and narrow fix if evidence supports it.
- Constraints: active DRM repair; avoid production requests, database writes and provider calls.
- Checkpoint: parent inspected pixels: Data health says roster player Judd Caulfield has no unique canonical identity. After DRM final handback, bounded SQL reads found canonical 7531/NHL 8481538 verified active_nhl/ANA and current Yahoo 477.p.31129/season 2026, but zero external crosswalk rows for either side. Legacy reader also empty. Exact canonical name unique. No actual user's account or league read.
- Local change: added exact-ID regression to `web/lib/integrations/yahoo/yahooDiet.test.ts`, demonstrating missing mapping failure and correct one-row repair in both readers while preserving conflict/season rejection. 30 tests passed; scoped eslint and diff-check passed. Runtime code unchanged, no build needed.
- Prepared `tasks/artifacts/rso-caulfield-2026-11-12/REPAIR.sql`: one transactional insert, fresh evidence/absence guards, timeouts and in-transaction reader check. NOT EXECUTED. No deployment needed for data fix. Production insertion requires TJ approval; do not silently auto-map similar names or bulk repair.
- Next: obtain approval for exact one-row production crosswalk, execute once after fresh safety check, read back both identity/view and test resolver with returned rows. User's subsequent Refresh provider is needed for end-to-end third-party roster acceptance; do not claim it verified without their account evidence.
- Completed 23:39 UTC: parent relayed TJ's explicit yes; fresh idle/lock check and transactional guards passed. One row inserted once, post-commit production identity + RSO view readback exact. Receipt in artifact folder. Focused regression passed. No production deployment or authenticated third-party UI verification; Refresh provider needed by reporting user.
