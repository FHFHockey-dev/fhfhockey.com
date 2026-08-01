# DRM local-gates checkpoint — 2026-08-01

This is a bounded local-only evidence receipt for the remaining DRM producer and
scheduler gates. It does not authorize or perform a database migration,
Production writer, repair/backfill, provider call, deployment, or schedule
change.

## Verification cohort

From `web/`, the following focused cohort passed **8 files / 77 tests**:

```text
npm test -- --run \
  __tests__/pages/api/v1/db/shift-charts.queue.test.ts \
  __tests__/pages/api/v1/db/shift-charts.audit.test.ts \
  __tests__/pages/api/v1/db/shift-charts.transactional.test.ts \
  __tests__/pages/api/v1/db/run-projection-v2.test.ts \
  __tests__/pages/api/v1/db/run-rolling-forge-pipeline.test.ts \
  __tests__/pages/api/v1/db/ingest-projection-inputs.test.ts \
  lib/supabase/gamecenterNormalizationMigration.test.ts \
  lib/supabase/Upserts/nhlRawGamecenter.test.ts
```

The cohort proves, locally and without writes:

- implicit offseason queueing uses the latest-started season and excludes a
  future season;
- completed rows from an older relationship algorithm are selected for the
  current materializer;
- compatibility and direct relationship requests produce one truthful audit
  row on success and on 400/405 validation failures;
- projection input cursors, lease recovery, same-date continuation, and
  fail-stop behavior retain the exact failed game/date;
- the local coordinator preserves input → relationship → derived ordering and
  the 210-second bounded runtime contract;
- normalized Gamecenter SQL is transactionally exact-replacement, raw-head
  bound, CAS/version guarded, service-only, and physically replay-safe;
- the TypeScript normalization client sends both immutable source hashes to the
  canonical RPC and accepts only an exact receipt.

The normalization-client regression now asserts both
`p_expected_pbp_payload_hash` and `p_expected_shift_payload_hash` in the RPC
argument contract (`web/lib/supabase/Upserts/nhlRawGamecenter.test.ts`).

## Remaining gates

This receipt advances only local evidence. NEW 20/22–29/32–33/37–39/41/49–51
remain open where their definitions require bounded history correction,
untracked/manual caller disposition, Production deployment or natural audit
receipt, schedule cutover, or an explicitly authorized writer. No external
state changed during this checkpoint.
