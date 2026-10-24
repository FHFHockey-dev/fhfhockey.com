# Independent billing migration relocation review

Outcome: **changes requested** for one P2 harness regression. The SQL relocation and authority-registry parity pass the requested focused checks; the current queue verification harness is not replayable after relocation.

## Finding

**P2 — Update the executable consumer of the frozen hash manifest.** `tasks/artifacts/in-season-billing-2026-10-21/queue-sql-verification/VERIFY-QUEUE.cjs:12–14` still reads every path and expected hash directly from `SOURCE-HASHES-BEFORE.json`; line 123 repeats that check. Updating the SQL-load path on line 53 does not update this indirect dependency.

The unchanged historical manifest expects the pre-relocation `monthlyIntegration.test.ts` hash `cb87e47d4d2b1050577a62cba6bebccb12101df57709dbcb6773d95abb3594b5`, whereas the authorized path-only edit has hash `778fb645067f9f45830dab69f90b721ad838d26cb4023356319634d081310025`. Its preflight therefore throws `ERR_ASSERTION` before SQL loading. The same manifest also names the removed `supabase/migrations/20261021210000_in_season_sandbox_billing.sql`, which raises `ENOENT`; resolving only the first mismatch leaves this second failure.

I reproduced the first failure by executing only the actual three-line hash-preflight excerpt in a Node 22.11.0 VM with local file/hash/assert dependencies. I separately confirmed the old SQL-path read fails with `ENOENT`. The full harness, target configuration, database clients, and SQL execution were not loaded. See [queue-preflight-reproduction.json](queue-preflight-reproduction.json).

Preserve the historical manifest and receipts. Add a narrowly scoped current replay receipt or relocation-aware resolution that validates the unchanged SQL bytes at the draft path and the authorized integration-test path edit, while retaining strict checks on all other frozen inputs. Apply that handling to both hash loops. The new provenance paragraph alone does not change executable path resolution. Recheck the preflight offline; no SQL execution is needed to verify this correction.

## Verified evidence

- The relocated SQL is a regular file, byte-identical to the packet base: SHA-256 `d78b385ec6b8acfbfcc6ba2909d5f558765cd90e8e4a18a2febab68bf146db12`. Its old canonical migration path is absent.
- All five changed reference/note files match the packet's before and after hashes. The patch hash is `d990b7f1c8e977c05232a8bf0e01a301eee061130abc79bee6958bb82a5b34b2`; reverse-apply checking against a disposable non-Git copy passed. No patch was applied by this review.
- The active migration directory and authority registry have exactly the same ordered 98 paths, each with matching SHA-256. Registry states remain 65 applied, 28 unknown, and 5 pending. Registry, baseline assertions, and summary hashes are unchanged.
- Hashing the 183 SQL files found under `supabase/migrations`, `web/supabase`, `migrations`, and `sql` found no copy matching the draft's basename or exact hash. This is a bounded source-root check, not a production database audit.
- All four updated direct SQL references resolve from their declared repository root or the web test working directory. All three modified CJS files pass `node --check`; the scoped diff whitespace check passed.
- The historical source manifest and tracked historical receipts remain unchanged. Only the four expected harness/report files changed within the tracked billing artifact subtree; the relocated draft is newly present.

The owner result packet records 21 baseline and 63 monthly-integration cases passing. Those 84 cases were inspected as owner evidence, not rerun by this reviewer. They and the syntax checks do not exercise the broken manifest preflight.

## Exact scope and limits

Candidate base: `a565238f670edc4cf65da79ad52ba82ec41f3b71`. The shared checkout advanced concurrently to `1cf7bf424fdf927570a13c361ce657d7a384962a` at initial checks and `1db72ffc62bd73106a98e0146f3342346bbce69c` at the final hash check. All reviewed candidate hashes still match; this review attaches to the exact files in [REVIEWED-HASHES.json](REVIEWED-HASHES.json), not unrelated commits. The reviewed queue harness hash is `ce68ce9a2e137e6d6769a61994fa163f2f1da2a08334473d4ae26f1121669b14`; its historical manifest hash is `f2c438904c06caaacbcdfd65b6ab47b35cf5c232ddf65bb20c36f99d06224659`.

Supporting receipts: [CHECKS.json](CHECKS.json), [syntax-checks.json](syntax-checks.json), and [historical-tracked-diff.json](historical-tracked-diff.json). This review created only its own artifacts and diary. No source edits, SQL execution, database access, production/NST/network requests, credential reads, commits, or deployment. No permission or tool blocker; acceptance is held solely for the concrete harness regression above.
