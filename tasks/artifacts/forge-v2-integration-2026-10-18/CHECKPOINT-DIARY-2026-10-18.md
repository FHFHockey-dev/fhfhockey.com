# Checkpoint diary: S-05 FORGE v2 daily-driver integration (2026-10-18)

```text
Diary: S-05 / session local_1bb829ea (means stage, v2 integration) / 2026-10-18 ~15:05 local
```

**Outcome and settled decisions**
- The combined v2 driver is staged as 4 ordered patches. It covers the Yahoo universe, fresh means, and participation (frozen-window method through 2026-10-27T04:00Z, rolling after that).
- All behavior still waiting on TJ sits behind flags that default off.
- Fresh means use a new outputs branch: a new bundle per policy, a policy row citing `tj-standing-approval-2026-10-17:forge-daily` for that day's candidate input hash, and a pending review.
- Rolling patch 02 needed rebasing at two hunks (context drift only).

**Branch / commit / dirty files / file hashes**
- Real checkout: `octoberBranch` @ `0de97e77d` plus the working tree. I wrote only into this folder; no real-checkout source file changed.

| File | sha256 |
|---|---|
| `01-kernel-export.patch` | `37150f8291d7bcfe1562a1de6887fa545fd948ce632a9488287cfc17f1a23d05` |
| `02-integration-rebased.patch` | `3d1e2b0a5d388a31c8a948f63322a25feb6ee6aebcdc68a899231e355868752f` |
| `03-v2-composition-new-files.patch` | `806ef0ec035e34ccad64723d1a1679e9a9e29bc1afacc617b3dbe5de0694c539` (was `990a4e86…`, before the review fixes) |
| `04-v2-driver-wiring.patch` | `9a1ebfc8caadc4a15e5420724f71ed4aff9f0be9bb7a1b244ceb6a39add1c795` |
| `base-blobs.txt` (git blob hash of every touched file at cut time) | `aa220cbc278dad05254906686bad0196617c2c8a75b1eda28f748f056416cd1e` (refreshed) |
| `replay-20261021.ts` | `d13468ad02f7c0d2aba4bd8c686fe67251dfbc1791ffb9cfb7957e7ad0a6ca38` |
| `replay-receipt-20261021.json` | `b230a208e263a03816fddf69129890c16c80be2b0a7d4cc5ca593f271edd675b` (re-run after the fixes) |

Key base blobs:
- `forge-daily.ts`: `f0df9311…`
- `nativeCadenceOutputPreparation.ts`: `fbc4e2c4…`
- `startChartContract.ts`: `d9dc8f3b…`
- `planning.test.ts`: `7ce06c2f…`
- `workspaceSchema.ts`: `ca9fda58…`

**Changes and evidence paths:** see `README.md` in this folder, which covers the patch table, stages, flags, replay and risks.

**Replay** at 2026-10-21 clocks, flags off, 0 network, 0 database writes (`replay-receipt-20261021.json`):

| Check | Result |
|---|---|
| Participation method | Frozen window |
| Universe | 69 players, 19 owned |
| Fresh means | 74 selected |
| Materialization request | 40.2 MB; 200 rows; 1,334 manifest items |
| Outputs | 94 rows; 577 sources; 5 fresh policies, each with a pending review |
| **Nulls** | **100 against a gate of 100: passes, exactly at the limit.** 20 are conflict-withheld, so 80 would count if the null-gate flag were approved |
| Plan validation | Pending plan rejected before review (as in v1); the reviewed plan validates, 94 rows |
| Cadence command validation | 94 rows |
| Expiry | 2026-10-21T23:29:59.999Z |

The replay used three stand-ins:
- the retained 69-player universe instead of a Yahoo read;
- retained club rosters and schedules, re-stamped to the run day;
- means history only through Oct 12.

**Flags that need TJ (all off by default)**
- `injuryPolicy` (plus the approved policy hash)
- `nullGateNonConflictOnly`
- `universeThresholds` (U4 ≤ 5 unresolved, U5 ≤ 10 added; U3 always gates)
- `rollingFirstIssuance`: needed from the Oct 27 run
- Separately, a first run that includes Fiala's prior boxscores goes over the ≈120-request bound.

**Tests:** run in the scratch copy with all patches applied, outside the repo.
- 21 focused Vitest files: 973 passed, 7 skipped, 0 failed.
- Scoped `tsc` over 25 files: exit 0.
- ESLint over the same 25 files: 0 errors and 0 warnings.
- Not run: the full `tsc` and the suites outside this list.

**Status / blockers:** staged; not applied. The frozen-file window ends 2026-10-20 17:00 UTC. Live run blockers:
- live captures for the Yahoo universe, NHL rosters and schedules, Oct 13–20 means and 7 goalie summaries;
- prior-season game IDs for skaters 9603, 10609 and Fiala;
- the materializer's 64 MiB limit, which the request approaches in late October.

**Operations:** none running. All replays and test runs finished. No locks are held (`/private/tmp/fhfh-heavy.lock` was released).

**Ownership:** none held on shared Git or servers. Scratch copy: `/private/tmp/claude-501/…/scratchpad/s05/repo`, which is disposable.

**Next commands** (after 2026-10-20 17:00 UTC, from the repo root, once the Monday run's files are released):

```bash
for p in 01-kernel-export 02-integration-rebased 03-v2-composition-new-files 04-v2-driver-wiring; do git apply --check tasks/artifacts/forge-v2-integration-2026-10-18/$p.patch && git apply tasks/artifacts/forge-v2-integration-2026-10-18/$p.patch || break; done
```

Then, from `web/`, run the post-apply `npm test -- …` list in `README.md`, then:

```bash
NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit
```

To roll back: `git apply -R` on 04, then 03, 02 and 01.

**Receiving owner:** Chef. Before applying, re-verify `base-blobs.txt` against the current files: other sessions may edit `workspaceSchema.ts`, `startChartContract.ts` or `planning.test.ts` in the meantime. No diary work is outstanding.

## Update: review fixes (REVIEW.md "needs changes"), 2026-10-18 ~15:30 local

**B1, fixed: participation coverage gate restored.** `assertParticipationCoverage` (in `nativeDailyPipelineV2.ts`) is called from `forge-daily-v2.ts inputs-v2`.
- **Frozen branch:**
  - It stops with `participation_template_lost:<n>` if any universe member had a retained template that was dropped for an identity or `rosterRevision` change.
  - It then applies v1's rule: `participation_coverage_incomplete` on any covered row with reasons or with 0 games.
  - The members that never had a template are still reported only.
- **Rolling branch:** the same coverage rule applies.

**B2, fixed: method gate.**
- `NATIVE_DAILY_APPROVED_METHODS` pins season 20262027 and the 6 policy-version → definition-hash pairs. These are the 2026-10-16 approved hashes; the current code reproduces them exactly.
- It also pins the 3 roster-observation participation datasets. The 3 rolling datasets count only with `rollingFirstIssuance` on.
- `outputs-v2` runs `assertStandingApprovalMethods` on the plan before writing anything. A mismatch stops with `method_not_in_standing_approval:<key>`.

**Patches after the fixes**
- Only 03 changed. Its new sha256 is `806ef0ec035e34ccad64723d1a1679e9a9e29bc1afacc617b3dbe5de0694c539`.
- 01, 02 and 04 are unchanged.
- `base-blobs.txt` was refreshed (new sha256 `aa220cbc…675b`). `startChartContract.ts` drifted again (`7a2618ec…`), but 02 still applies.

**Checks after the fixes**
- `git apply --check` plus apply, 01 → 04, in a throwaway repo of current bytes: all OK.
- `nativeDailyPipelineV2.test.ts`: 8/8 (2 new tests).
- Scoped `tsc` over 25 files: exit 0.
- ESLint on the 3 changed files: clean.
- Oct 21 replay re-run: the same results as before, with both gates passing.
  - method frozen; 1,260 participation inputs; 94 rows
  - nulls 100 / gated 100 against a gate of 100
  - 6 pinned policies and 3 participation datasets
  - reviewed plan 94, cadence command 94; expiry `2026-10-21T23:29:59.999Z`
  - new receipt sha256 `b230a208…675b`

**Non-blocking review items, left open by direction**
- **N1.** When `universeThresholds` is on, require `--previous` (`change` must be non-null).
- **N2.** In the rolling branch with `injuryPolicy` off, no conflicts carry. State this in the `rollingFirstIssuance` request to TJ.
- **N3.** The `prospectiveEvidenceRef` rewrite never fires on the current templates. Drop it or document it.
- **N4.** Add CLI-level tests for the `inputs-v2` and `outputs-v2` gates.

**Focused 21-file suite (re-run after the fixes):** 21 files; 975 passed, 7 skipped, 0 failed.

**Stopped at:** done. Both blocking items are fixed and verified. Nothing is running and no lock is held. The apply steps above are unchanged; use the new 03 sha256 when checking.
