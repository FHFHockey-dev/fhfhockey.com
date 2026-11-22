# octoberBranch ← master reconciliation: prep record (not executed)

Chef (Claude), 18:5xZ Nov 21. **Nothing was changed:** both branch tips, the shared checkout, its index and its 17 modified tracked files are untouched. There was no stash, reset, merge, worktree or push. The merge was computed only in the object store (`git merge-tree --write-tree`). The trial resolution ran in Chef's scratchpad.

TJ's rule (verbatim intent): leave both tips untouched; record the three conflicts; reconcile **once**, against the **final** master after the BLSH release outcome is known, and after the active edits (RSO, News and others) are checkpointed. No stash, reset, force-push or cleanup of others' files. This doesn't block BLSH or the Nov 22 readback.

## Inputs at prep time
| | SHA |
|---|---|
| octoberBranch | `11bea873f95ac07b7994fc3029b4d8cd6c2e448b` |
| origin/master | `096b78b622a72a8378b8f60c0c7704fc4e2fee41` |
| merge base | `02f0426d557e8e13c85e452759c1a1566285d950` (old: Nov 19) |
| merge-tree result | `363445c33d8e92dc29acc63a44de300b30c15e38` (exit 1, 3 conflicted paths) |

Redo all of this against the final master; BLSH R′ will move it.

## Root cause
- TJ's bulk checkpoint `3ee9e7dea` ("11/21", Nov 21 10:52 CT) brought in the full contents of **`74f31aded`** ("FORGE: publish one qualified pregame packet and verify RSO readback").
- That commit is the Codex/Astra **"FORGE output and capture reliability"** lane's unreleased candidate (diary `2026-11-17-codex-forge-pipeline-reliability.md`). It sits on top of `83750b4ab`, is on **no branch**, and has its own registered closure `0bea3cd4…` (receipt `tasks/artifacts/forge-pipeline-reliability-2026-11-17/74f31aded….json`).
- Master shipped pregame publication a different way (`bb8693f19` → `012a5f014` signed verdict → `91f745191` attribution → `f47905d28` → `096b78b62`).
- So octoberBranch holds a **parallel, unreleased design** of the same FORGE subsystem. It is not simply one release behind.

## The three marked conflicts
| File | Hunks | octoberBranch side | master side | Proposed resolution |
|---|---|---|---|---|
| `web/lib/projections/pregameCapture/hostedReaders.ts` | 8 (add/add) | Pre-signed-verdict reader: no `verdictGate`, no `attributeDetailedExclusion`, `process.env`, issuedAt bound to observed micros | Released reader with the signed-verdict gate, game-level exclusion attribution (`91f745191`), `forgeEnv()`, and issuedAt bound to the run's `created_at` | **Take master.** The octoberBranch side has nothing master lacks. Master is what served live 0359 today. |
| `web/lib/projections/run-forge-projections.ts` | 4 | = `74f31aded` exactly: `lifecycle.observeSuccess` (post-success observation), `calendarRevisionOf(...)`, `RunProjectionV2Result` | `forgeEnv` import, `projectionInputHash(schedule revisions)`, `RunProjectionResult`, no `observeSuccess` | **Owner decision (Astra/Codex FORGE lane).** Taking master breaks `74f31aded`'s post-success observation: `run-projection-v2.ts` gets a type error on `record_succeeded_observation`, and 9 resume tests fail. Keeping `74f31aded` reverts released writer code. A correct merge ports `observeSuccess` onto master's writer, or drops the feature from all 24 files below. |
| `web/lib/projections/verifiedForgeReleases.test.ts` | 1 | Expects closure `0bea3cd4…/74f31aded` | Expects six released closures through `0446100e…/e2f8c6bc9` | **Union, in registry order** (master's six, then `0bea3cd4`). The registry `.ts` itself auto-merges with all entries, `0bea3cd4` last. Whether `0bea3cd4` should stay listed at all follows the decision on `74f31aded`. |

## The bigger hazard: 24 silent hybrids
These files auto-merge with **no conflict marker**. The merge mixes `74f31aded`'s changes into released master code, and nobody has tested the result. Diffs below are merged vs master:
- forgeDailyBridge.ts +109/−43 (**daily RSO reader**) and its test +100/−42
- run-lifecycle-queries.ts +52/−5
- run-projection-accuracy.ts +34/−22 and its test +56/−15
- run-projection-v2.ts +3/−1 and its test +7/−4
- laterImpactInputs.ts +18/−11 and its test +16/−7
- lineupGaps.ts +21/−3 and its test +83/−1
- externalInputProof.ts +11/−2
- issuedContext.ts +5
- pregameCapture/runner.ts +12/−10
- forge-pregame-publication.ts +31 and its test +64
- run-forge-projections.resume.test.ts +167/−12
- publicationConsumer.test.ts +243
- the publicationConsumerDb fixture +112
- world/store fixture +9/−10
- computeOff.test.ts +27/−1
- parity.test.ts +76/−3
- forgeReservePayload fixture +1/−1
- supabase/tests/forge_pregame_publication.py +474

## Trial resolution (scratch only; evidence that the auto-merge is not coherent)
- **Resolution used:** master for `hostedReaders.ts` and `run-forge-projections.ts`; union for the test. Export of `web/` only.
- **FORGE producer closure of the result:** `256381ea5c5a19d0430ea3747243d41a128dd29b1c6aa6f458547b251c60910d`. This is not released `0446100e…` and not in the allowlist, so a production build from it would fail admission.
- **Typecheck:** exit 2, 60 errors.
  - 3 are real merge errors: `__tests__/pages/api/v1/db/run-projection-v2.test.ts:362` (`record_succeeded_observation`), `pages/api/v1/db/run-projection-v2.ts`, and `run-forge-projections.resume.test.ts`.
  - The rest are environmental: the export lacked `supabase/functions` and `tasks/`.
- **Focused Vitest (7 files):** 34 of 185 failed.
  - 9 in `run-forge-projections.resume.test.ts` and 1 in `publicationConsumer.test.ts` are real: the observation lifecycle and a TypeError.
  - 24 in `verifiedForgeReleases.test.ts` are environmental: receipts under `tasks/` were missing in the export.

## Reconciliation plan (execute once, later)
1. **Preconditions:**
   - BLSH release outcome known; final master SHA recorded.
   - Active edits in the shared checkout checkpointed by their owners. Their commits are theirs; Chef does not commit others' files.
   - TJ's go-ahead for the merge commit.
2. **Owner decision on `74f31aded`,** asked of TJ with the Codex/Astra FORGE lane's input:
   - (a) **Port** its post-success observation and reliability changes onto released master code as a new candidate. That gives a new closure plus a receipt and gates, released separately.
   - (b) **Drop** it from octoberBranch: take master's version of all 26 files and remove `0bea3cd4` from the registry and test. Keep `74f31aded` reachable by tag or ref so the work isn't lost.
3. **Recompute the merge** against the final master in the object store, apply the decided resolution, and verify in a clean export of the **whole repo**:
   - typecheck;
   - the focused FORGE and RSO Vitest set above plus `verifiedForgeReleases`;
   - the closure hash: it must equal the released closure for (b), or be registered for (a);
   - the CSS-module pure check, since octoberBranch has many `.module.scss` changes.
4. **Commit:** one merge commit on octoberBranch with explicit pathspecs, made only after the checkpoint and with no stash. No push without approval: per memory, octoberBranch pushes go together and are checked against Vercel preview settings with TJ.

## Not blocking
BLSH R′ (on master) and the Nov 22 10:05Z readback run on master/production and do not touch octoberBranch.

## TJ decision (18:5xZ Nov 21) and follow-up
- **Preserve 74f31aded:** local annotated tag `preserve/74f31aded-forge-output-reliability` → `74f31aded0fa7517f6de313c5f0e9998dd37f5bf`. Not pushed.
- **Reconciliation:** superseded 74f31aded changes stay out. Only still-required behavior proven to exist only in 74f31aded gets a separate, smallest tested port. The whole commit is never ported.
- **Comparison:** runs in an isolated detached worktree, `/private/tmp/forge-74f31aded-compare-20261121` at `096b78b62` (no new branch). Lane: gap-74f31aded (local_4684ce0e…). Results go to `side-session-notes/local_9996b7b8…/gap-74f31aded/`.
- **Untouched:** master, octoberBranch and the shared checkout. No push, build or deploy, and BLSH is not interrupted.

## 74f31aded gap analysis: result (19:0xZ Nov 21)
- **Source:** gap-74f31aded lane. `side-session-notes/local_9996b7b8…/gap-74f31aded/GAP-ANALYSIS.md` sha `163504ef…`, `gap-analysis.json` sha `f7f12182…`, logs 01–05, SHA256SUMS. The worktree is restored clean at `096b78b62`.
- **116 hunks over 29 files:** in_master 15, superseded 72, obsolete 5, **gap_required 0**, gap_optional 24 (G1–G7). **No port was made**, and released closure `0446100e…` is unchanged.
- **Chef spot-checks:**
  - the migration `20261118135813` is byte-identical on master and stamps `succeeded_observed_at` in SQL (lines 66–78);
  - master's bridge issues `issuedAt` from `created_at` (`forgeDailyBridge.ts:387`);
  - the only production `decisionAsOf` callers are the capture paths (`hostedGame.ts:121`, `nativeInputs.ts:31`).
- **Resolution for the eventual reconciliation:**
  - Take **master's version** of all 74f31aded-derived files (the 24 silent hybrids plus `run-forge-projections.ts`) and of `hostedReaders.ts`.
  - **Leave `0bea3cd4…/74f31aded` out** of the registry and its test. It came via `3ee9e7dea`, not 74f31aded, and describes a build that will never ship. The work itself stays reachable through the tag `preserve/74f31aded-forge-output-reliability`.
  - Expected: octoberBranch's FORGE producer closure equals released master's at reconciliation time.
- **Optional items (not ported; each would be its own ticket if wanted):**
  - G1: reserve-flag environment key in the model identity, which gives an earlier error but changes the closure;
  - G2: per-team `skater_coverage` across resumes;
  - G3: don't demote an unclaimed success on a lost ack (fail-closed path no route uses);
  - G4: compare-and-set on accuracy metadata;
  - G5: plainer RSO lineup-blocker copy;
  - G6: the `forge_pregame_publication.py` SQL regression, which passes 52/52 on master's migrations and is test-only;
  - G7: a fixture.
  - G8 (per-game cutoff on resumed daily runs) would be a new design, not a port.
