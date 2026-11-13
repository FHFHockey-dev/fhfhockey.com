# Astra recheck: releases #439–#442, migrations 147 and 149, decision 152 refresh and serving (2026-11-13)

You are **Astra**. This is a short, independent, **read-only and offline** recheck of the Chef's evening work. Don't reopen the full audit.

**Pinned commit:** octoberBranch `245afeb0d9ca9dacb0cc91a0e92933522c8b4c0f`.

**Ground rules:**
- No production calls, reruns, edits, commits or pushes.
- Ask TJ any question by pop-up.
- Never print secrets. Never set GIT_DIR.
- **Queue this behind your shift-chart parser fix.**

Records: `master/production/PRODUCTION-QUEUE.md` (entries after release #438), `master/production/RELEASE-NEXT-HANDOFF.md` §7–§9, `master/production/pp-clock-validation-2026-11-13/` (REPORT §10–§18, `MIGRATION-149-PACKET.md`, `PP-REFRESH-PLAN.md`, `REFRESH-APPROVAL-PACKET.md`, `results/after-d152/`), `OWNER-DECISIONS.md` decision 152, and `tasks/tasks-fix-sprint-closeout-2026-11-13.md`.

## 1. Releases: candidate and tree identity, scope
| Release | Master | Candidate | Scope claimed |
|---|---|---|---|
| #439 | `a448842d1` | `7a3a69ef4` | Item 1 writer and test plus `leagueSavePct` and its test, at their `0e8d377ae` blobs (not cherry-picked whole); item 2 excluded |
| #440 | `70ad65546` | `2681a05bc` | The 16 files of composed `a36a878c5` (item 6 readers plus the nullable writer); baseline test at 147-applied |
| #441 | `f5c7adc2d` | `48c4bcb83` | Decision 152 writer, batch dry run, write gate, registry, migration 149 file; equal to dry-run code `8f73d2931` |
| #442 | `44de2f107` | `28fdbadd6` | PP share readers and the shift-chart timing guard (F11 `05c43f981`, `aac8cf5a3`, `486da9666`); F11's later `8b94e18c0` is test-only |

**Verify:**
- each release's sole parent is the previous release, and its tree equals its candidate;
- the app paths match the claimed scope, and item 2 (`run-projection-accuracy`) is absent from all four;
- #439 `leagueSavePct`: the read-only count claim (2,764 valid pairs; old and new sums identical as of 2026-11-14) is consistent with the code paths. Don't re-query.

## 2. Migrations 147 and 149 (live receipts; don't re-query)
- **147 `20261113190000`:**
  - the pre-check found the ledger and live schema agreeing (not applied);
  - atomic apply with its ledger row at 19:45:17Z;
  - readback: 5 columns nullable, six null-check markers, grants unchanged.
- **149 `20261113220000`:**
  - atomic apply at 20:36:48Z;
  - readback: 7 constraints, RLS, grants, a service-role-only RPC, `powerPlayCombinations` unchanged (47,688 rows).
- **Check:** file sha256 against the authority rows; that the "atomic" wrappers really committed the schema change and the ledger row in one transaction (the methods are recorded); and the authority counts (115 applied / 6 pending) against `supportedBaselineMigration.test.ts`.

## 3. Decision 152 refresh
**Inputs and expectations:**
- Local dry run: DB-enforced read-only export, manifest `bbcba75c…`; `dry-run.json` sha256 `db94a9de…`, accepted by TJ.
- **Reconcile the 618 team-games yourself:** 593 unchanged; 16 changed = groups A ∪ B ∪ C; 15 deletes, 23 PP updates plus 14 unit-relative updates, 5 inserts; 9 not applicable.

**The write:**
- Write phase 20:59:38–21:03:46Z; the log is in `results/after-d152/refresh-write-2026-11-13T2059Z.txt` (31/31 batches "readback matches the dry run").
- Chef readback: 7,180 rows all stamped, 618 clock rows (609/9/0), other seasons 40,498 rows and 0 stamped.

**Check:** the runner's readback logic (`20-refresh-runner.py`) truly compares rows, values and clock availability against the dry run, and stops on the first mismatch.

## 4. Flags, deploys and serving
**What happened:**
- `PP_STORED_CALCULATION_WRITES_ENABLED=true` (TJ), then clean-export deploy `dpl_DgmG26oS5`.
- `PP_SHARE_SERVING_ENABLED=true` (Chef via CLI, TJ-approved), then clean-export deploy `dpl_3dTQdAD3`. Both deploys built from the exact master SHA, with `tasks/` trimmed to `tasks/TASKS`.
- Live checks (recorded): the clock API; `/api/toi` for 8475158 (112 s, 93.33%) and 8474586 (t55, not applicable, share null); the shift chart label for NSH; the line-combo PP matrix diagonal equal to the dry run.

**Verify in code and tests:**
- **Flag-off parity:** the rolling writer's stored rows are field-for-field equal to master (`fetchRollingPlayerAverages.ppServingPin.test.ts`).
- **The cross-surface test** (`web/__tests__/ppShare/decision152CrossSurface.test.tsx`).
- **The shift-chart guard:** bands are drawn only when their merged seconds equal the clock, and are otherwise withheld with the label, never stretched. The documented limit (totals only) is stated correctly.
- **Availability rules:** not applicable shows "N/A", never 0%; unavailable shows its reason; nothing is capped.
- **Known gaps to confirm as recorded:**
  - with serving off, the client readers made one cached gate request (moot while serving is on);
  - other seasons are still on the earlier writer;
  - the parser fix is pending (yours).

## Output
- Pass or fail per section, with commits, the tests you ran and any gap.
- Hand the summary to TJ, or write it to `master/astra/ASTRA-RECHECK-439-442-2026-11-13.md`.
- Keep the 2026-11-14 scheduled readbacks (08:05Z cron 388, 10:05Z FORGE reserve and goalie inputs, 10:15Z cron 283) separate.
