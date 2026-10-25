# Retained billing sandbox maintenance sources

The sandbox SQL remains outside the supported migration chain. Its retained draft and `web/lib/in-season/__fixtures__/monthly-sandbox.sql` are byte-identical (SHA-256 `d78b385ec6b8acfbfcc6ba2909d5f558765cd90e8e4a18a2febab68bf146db12`). The monthly integration test uses the web fixture; the historical local SQL/Auth harnesses retain their approved draft reference.

The original queue runner, source manifest, relocation v1, correction test and two CHANGED-FILES provenance receipts are preserved byte-for-byte. The historical runner deliberately rejects changed current monthly-test bytes. Use the versioned v2 runner for the current release sources:

```sh
node tasks/artifacts/in-season-billing-2026-10-21/queue-sql-verification/VERIFY-QUEUE.v2.cjs --preflight
node --test tasks/artifacts/billing-migration-authority-2026-10-22/queue-preflight-fix/VERIFY-QUEUE-PREFLIGHT.v2.test.cjs
```

These commands use only local source reads and built-in Node modules; preflight exits before any target configuration or database client loads. V2 pins the current test and fixture, keeps all five unaffected input pins, and verifies original manifest, relocation receipt, v1 manifest/runner and correction receipt before and after database work. No historical evidence or hash guard is relaxed. V2 uses exclusive versioned result destinations.

The local SQL/Auth harnesses and queue runner without `--preflight` require separately authorized disposable environments. Historical machine-specific paths are retained as source provenance, not usable target configuration. No target files, credentials, raw database results, historical execution logs or acceptance claims are included. Clean-clone offline preflight is supported; no database execution is authorized by these files.
