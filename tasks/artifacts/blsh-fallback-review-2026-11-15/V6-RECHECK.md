# BLSH v6: recheck of the V6-REVIEW findings (`c0789453`)

**Reviewer:** the same independent session. Requested by Chef on 2026-11-15.

**Conditions:**
- Offline and read-only. Nothing applied, deployed or committed.
- `GIT_DIR` was unset in every run.
- Tests ran in a fresh scratch export: HEAD `web` and `supabase`, plus every file in v6 `SHA256SUMS` `ae8caef1…` (40 entries, all OK). The `web/vercel.json` copy equals the working copy.
- Test runs used `sandbox-exec`, with outbound network denied except localhost and Unix sockets.
- **Network:** WebSearch and WebFetch were used on vercel.com docs only, as the brief allowed.

**Disclosure:** the SQL test again started a disposable local Postgres (Unix socket only) in the per-user temp folder. I removed the folder my run created.

**Baseline:** I diffed against the exact bytes I reviewed, kept in scratch. Unchanged since V6-REVIEW: `adapter.ts`, `writer.ts`, `handler.ts`, `sourceDate.ts`, `requestContext.ts`, the request-context migration and `SCHEDULE.sql`. Changed: `core.ts`, `sink.ts`, `runtimeReceipt.ts`, the route, the capture migration, tests, docs and `web/vercel.json`.

## Overall verdict

**(a) An inert deploy plus applying both migrations: APPROVE.** The switch defaults off, nothing is scheduled, and the route refuses before any claim.
- The deploy is still a remote Vercel build that needs TJ's own approval under the cost rules.
- The `vercel.json` change gives the deploy one more function.

**(b) What gates scheduling or `enabled = true`:** the approved deployment probe (PROBE-LIST), in particular:
- **M1:** Fluid compute on or off, plus a read-only check that the deployment lists `blsh-native-capture` as **its own function with timeout 250** (for example `vercel inspect <deployment> --json`);
- items 6, 7 and 8 (dispatcher anchor, warm-instance TLS, backup on a warm instance), 12 (off-day body shape) and 13 (dashboard Storage policies);
- REGISTRATION landing in the same change as the inventory entry;
- TJ's approvals of `SCHEDULE.sql` and of enabling.

## Item verdicts

| Item | Verdict |
|---|---|
| **M1** in-process isolation | **Partly fixed, correctly gated.** Isolation from other routes follows Vercel's documented bundling rule. The Fluid residual is carried as a PROBE-LIST item that gates scheduling. |
| **L1** missing D | **FIXED** |
| **L2** pre-schedule checkpoint budget and PROBE item 11 | **FIXED** |
| **L3** start refusals | **FIXED** |
| **L4** `need()` restored, diff equals CORE-DEVIATIONS | **FIXED** |
| **L5** retention order | **FIXED** |
| **L6** bucket privacy assertion | **FIXED** |
| **L7** approved DESIGN bytes and doc fixes | **FIXED** |
| No other behaviour change | **APPROVE**: a few side changes, listed below, are all acceptable |

## M1

**What the docs say (vercel.com, fetched 2026-11-15):**
- Advanced Configuration: "For Next.js projects, Vercel groups compatible routes into shared Vercel Functions". With a `functions` entry, "Vercel will bundle functions based on the configuration first". Its Next.js example says a route "will be bundled separately … since each has a different configuration".
- So a distinct config does isolate this route from the shared `pages/api` function. That removes the every-minute `/api/internal/*` crons and every other route from the capture's process.

**What I could not confirm in the docs:**
- **Overlapping patterns:** the route matches both `pages/api/**/*.ts` (240) and its own entry (250). Neither the vercel.json reference nor the duration page says which wins; the duration page only says "the order in which you specify file patterns is important".
- **Code precedence:** I did not find the lane's quote "Settings in your function code always take top priority".
- The route also exports `config.maxDuration = 250`, so the code and the specific entry agree, and only the generic glob differs.
- **This is why** the probe's read-only check of the deployed function list (own function, timeout 250) is required. It is already in PROBE-LIST item M1. `handler.test.ts` pins the exact `functions` object.

**Fluid compute:**
- The docs describe Fluid as a project-level setting (dashboard, or `"fluid"` in vercel.json), with no per-function opt-out of in-function concurrency.
- So the residual is another invocation of **this same function** during a capture. Its main source is an outside request with any bearer, because `adminOnly`'s JWT path makes two supabase-js calls on the global fetch.
- M1-ISOLATION.md states this correctly, and PROBE-LIST item M1 **gates scheduling**.

**Is a narrowed observer needed?** **No**, not for the inert deploy, and not if Fluid is off.
- **If Fluid is on and TJ keeps it, I'd prefer a cheaper fix over the narrowed observer:** a cron-bearer check **in front of** `adminOnly` for this route only.
  - It removes the outside, unauthenticated vector without changing the reviewed v5 observer, and it needs only a small review.
  - What remains is a duplicate cron-bearer trigger landing during a capture. Its `already_claimed` path makes no undici call before its response, but its audit insert does, so the gap is the probe's 12:05/12:20 timing.
- **Keep the narrowed observer in reserve** for the case where the probe shows other same-process traffic. It also drops v5's detection of an unexpected second request inside an action, which is a real (if small) assurance loss.

**Reproducer:** the M1 mechanism is unchanged by design. In recheck R-M1 ×2, one unrelated event during the admission or NST call still fails the run after that call was spent.

## L1–L7

- **L1:** `completedGames` now requires D's day entry. A missing entry gives `schedule_shape_invalid` (failed); `games: []` is still `no_slate`. Recheck R-L1a/b. Whether a real off-day lists D is PROBE item 12.
- **L2:** the pre-schedule checkpoint now runs before the schedule's timer is armed, with its own 20 s budget, still inside the 120 s.
  - Recheck R-L2a: 4 × 4 s writes (16 s) now complete.
  - Recheck R-L2b: 4 × 6 s writes (24 s) fail with `pre_schedule_checkpoint_failed_nothing_sent` and 0 fetches.
  - `sink.checkpoint` is now serialised, so an abandoned upload loop is waited on, not run twice. This removes V-R2's double-loop side effect.
  - PROBE item 11 is corrected: 2 round trips per object, about 2.5 s per round trip for the pre-schedule budget, about 2 s sustained for the whole run.
- **L3:** the plan, date, project, adapter-date, dispatcher and RUNTIME checks are inside the `try`. Recheck R-L3: the run closes `failed` with `plan_date_or_run_mismatch`, `closed: true`, no network.
- **L4:**
  - `peerFacts` and `tlsFacts` in `core.ts` are byte-identical to v5's (extracted and compared).
  - `diff -u` against v5 has 14 hunks, and `core-v5.diff` and `adapter-v5.diff` match the live diffs exactly.
  - CORE-DEVIATIONS maps every hunk to a numbered deviation, and my read of the hunks agrees.
  - The v5 names are restored (`DISPATCHER_AT_RUNNER_LOAD`, `sameAsRunnerLoad`, `global_dispatcher_not_runner_load_default`), consistently across code, tests, PROFILE-SPEC and PROBE-LIST, with no leftover `core_load`.
- **L5:**
  - rows are never deleted: the guard refuses every DELETE, and the retention GUC is gone;
  - pruning is owner-only (not even `service_role`): list, then delete the bytes through the Storage API, then `mark_pruned_v1`, which refuses while any byte remains and refuses kept, claimed or recent runs;
  - `pruned_at` is set once and never on a kept run;
  - 8 new SQL checks cover this.
- **L6:** a `do` block after the insert refuses an existing bucket unless it is private, 2.5 MiB, and JSON/HTML only. Two new SQL checks: a public pre-existing bucket is refused, and nothing is applied. Dashboard policies are PROBE item 13.
- **L7:**
  - `DESIGN-APPROVED-f6f78878.md` hashes to `f6f78878…`;
  - lines 1–500 of `DESIGN.md` are byte-identical to it, so only the appendix (errata and pointers) was added;
  - the errata cover the intent row, the upload timing, partial completion, retention, the bucket, the missing day and the RUNTIME key;
  - REGISTRATION.md and CRON-SCHEDULE-ENTRY.md both carry the "land together" rule.

## Behaviour changes beyond the findings (all acceptable)

- **New reason codes:** `pre_schedule_checkpoint_failed_nothing_sent`, `intent_or_checkpoint_failed` and `capture_work_failed` (the group loop is now wrapped).
- **Outer `catch`:** it now records a thrown error's message when nothing was recorded, but **only** if it matches `^[a-z][a-z0-9_:]{2,100}$`. Thrown messages in this path are internal codes, so this stays value-free.
- **`retention_v1` signature:** it lost `p_dry_run` (it is now list-only and STABLE). The revoke list now includes `service_role` before re-granting the 8 RPCs.
- **Info:** after a pre-schedule checkpoint failure, FAILED.json lists the schedule operation as `started`, although nothing was sent; the reason code says `nothing_sent`. A reader treats `started` as possibly sent, which is conservative. Marking it `not_sent` would be clearer. Not blocking.

## Checks

| Check | Result |
|---|---|
| v6 `SHA256SUMS` `ae8caef1…` | 40/40 OK |
| Vitest: 8 v6 files plus 5 census files (sandboxed) | **173/173** (v6: 40) |
| `tsc --noEmit` (direct, 8 GB, sandboxed) | **exit 0**, 0 errors |
| SQL test, disposable local Postgres | **57/57, RESULT OK** |
| Recheck reproducers (`repro/v6/recheck-tail.test.ts.part`, output `recheck-repro.out`) | **7/7**: R-L1a, R-L1b, R-L2a, R-L2b, R-L3, R-M1 ×2 |
| Vercel docs | fetched; quotes above |

**Logs:** `logs/v6-recheck/`. The reproducer tail is appended to the harness lines of the current `core.test.ts` (lines 1–109); see `repro/v6/README.md`.

**Sources:**
- [Advanced Configuration: bundling](https://vercel.com/docs/functions/configuring-functions/advanced-configuration)
- [Configuring Maximum Duration](https://vercel.com/docs/functions/configuring-functions/duration)
- [vercel.json reference: `functions` and `fluid`](https://vercel.com/docs/project-configuration/vercel-json)
- [Fluid compute is now the default for new projects](https://vercel.com/changelog/fluid-compute-is-now-the-default-for-new-projects)
