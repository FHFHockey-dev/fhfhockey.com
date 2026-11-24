# Approval packet: unblock master, then the standalone-WGO daily FORGE gate and the Rankings readiness migration

Chef, Sun 2026-11-22. Local only. Nothing is pushed or applied.

## Candidates (linear; each fast-forwards origin/master `c2c46ceae`)

| Step | SHA | Contents | FORGE closure |
|---|---|---|---|
| A | `a9e08f854be6575c856197e4cfd680940a1cabb1` | `c2c46ceae` (#464) + registration of `7ee3612e` (verifier receipt `96eaa4ce…`, 243 modules, 0 findings) | `7ee3612e` (registered in A) |
| C | `ebfdf1cd20190ce4d3dff33b81c2ef2cd0d20d54` | A + WGO writer digest (`4f362fed2`) + scheduled readiness gate (`169718455`) + registration of `af8b8d11` (`a86a99898`) + Rankings migration `20261122145409`, fixture, harness and rollback | `af8b8d11` (registered in C; 244 modules, 0 findings) |

## Gates (Chef, clean `git archive` exports)
- **Fast-forward:** A and C fast-forward origin/master; `git merge-tree` is clean.
- **Production build admission** (VERCEL_ENV=production, exact SHA, recomputed closure): **pass** on A and on C.
- **Typecheck:** exit 0 on A and on C.
- **eslint:** exit 0 on C's touched web files.
- **Registry tests:** 28/28 on A.
- **Vitest on C** (db routes, cron, registry, scripts): 2,734 passed, 20 failed. All 20 are `scripts/blsh/nativeProcessCaptureBootstrap.test.ts`. A clean export of master fails it identically, because it pins source hashes. C touches no file it covers.
- **WGO lane:** 772/772 across 48 files, plus 41 registry/admission tests.
- **Rankings SQL harness** (`supabase/tests/rankings_publication_readiness.sh`): both fixtures pass on PG15 and PG17. They include the 500-of-504 rewrite (it defers) and compatibility with the in-pipeline `startDate` receipt.
- **Production read-only checks:**
  - Nov 19 and Nov 21 games are type 2, `OFF`, with state refreshed at 10:05:28Z.
  - Every game has 18 WGO skater rows on each side (H/R).
  - Job 9 (07:32Z) wrote all 504 Nov 21 rows with 0 failed dates.

## Behaviour after C
- **Scheduled runs:** the scheduled `daily_incremental` run no longer calls `update-wgo-skaters` or the totals route.
- **Readiness check, before NST:** exact source date, finalized games (type 2, PPD excluded), the newest clean job-9 audit as cutoff (≥ last start + 3 h), per-game home and road rows, and **`wgo_skater_date_digest(D)` recomputed at read time equal to the receipt's `sourceDigests[D]`**.
- **Not ready:** exact gaps are recorded. NST, WGO and downstream steps don't run, and the next slot rechecks. Stale data is never published.
- **Off day:** no WGO is needed; NST still verifies.
- **Explicit-date repairs:** they still call WGO.
- **Rankings:** accepts the same verified standalone receipt; the old `startDate` receipt still counts.

## Rollout (each line needs TJ's approval)
1. **Precondition:** E2-1 is done and BLSH posts E2-1 DONE. Remote master is still `c2c46ceae`, and nothing is building.
2. **Push A** (already approved): 1 build plus 3 canceled companions. Watch it to READY, then smoke `/api/v1/runs/latest` once. Rollback: `dpl_A6wXhPbxbrNJWGCThoe5bsouyHmG` (`480bd5d71`).
3. **Apply migration `20261122145409`** to production. It is additive: a new `wgo_skater_date_digest` RPC (service_role) and a replacement of `read_rankings_publication_readiness`. Read back the function, the grant and the `schema_migrations` row.
4. **Push C** **before 07:30Z** and outside 07:30–10:55Z: 1 build. Watch it to READY, smoke once.
5. **Transition:** until job 9 runs on C (Mon 07:30Z), receipts carry no digest, so FORGE and Rankings both defer (`producer_digest_missing`). The first natural pass is the Mon 10:05Z run. A deploy between 07:30 and 10:55Z costs that day.
6. **Acceptance:** schedule one more read-only pg_cron call of `/api/v1/db/forge-daily-acceptance` for Mon 11-23 11:15Z (control). Remove jobs 429 and 430, plus this one, after Nov 27.

## Rollback
- **Web first:** promote the previous deployment or revert C. The old path calls WGO in-process again, and Rankings still accepts its `startDate` receipt.
- **Then the migration:** `tasks/artifacts/rankings-daily-publisher-release-2026-11-21/rollback-20261122145409.sql` (blob `0a7367849273`). It restores the `20261118151903` body, drops the digest RPC and deletes the version row.
- **A only:** promote `dpl_A6wXh…`.

## Known limits
- **No auto-repair** for a partial or stale 07:30Z capture: the gate reports it every slot until job 9 or an explicit repair rewrites the date.
- **No alert:** a never-ready day surfaces only through the 11:15Z acceptance check, serving health and the `wgoReadiness` gaps.
