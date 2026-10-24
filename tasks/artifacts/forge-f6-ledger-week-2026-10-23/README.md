# F6 Release C ledger-week audit — prepared offline

This artifact is an executable, fail-closed Q3–Q6 preparation packet. It changes no ledger application code or schema and makes no production request. No model or release is qualified by this work. The initial baseline is **Release C `d4c2632d39ee8a59fa683f44a0e1d21c55db66bd`**, not R23 or the held octoberBranch producer.

## Run offline

Requires only Python 3.9+ standard library. From this directory:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest -v test_audit.py
PYTHONDONTWRITEBYTECODE=1 python3 fixtures.py > /tmp/f6-synthetic.json
PYTHONDONTWRITEBYTECODE=1 python3 audit.py /tmp/f6-synthetic.json > /tmp/f6-synthetic-report.json
PYTHONDONTWRITEBYTECODE=1 python3 fixtures.py mixed > /tmp/f6-mixed.json
PYTHONDONTWRITEBYTECODE=1 python3 audit.py /tmp/f6-mixed.json
```

The valid synthetic fixture returns 0, `SYNTHETIC_TARGETS_PASS`, 70 dressed skater-games over seven game-bearing days, zero FP bias, ratio 1, decile-10 ratio 1, and PP A/G 1.85. `mixed`, `incomplete`, and `unverified-issuance` fixture cases return 2 (`REFUSED`). A complete cohort that misses numeric targets returns 1 (`TARGETS_FAIL`). All reports retain `production_qualified: false`: passing descriptive targets does not authorize a model release. An invalid/incomplete JSON input also returns 2. No environment files, credentials, network libraries, application modules or DB clients are loaded.

## Baseline and actual first issuance

The retained release receipt in `tasks/diaries/2026-10-22-claude-forge-improvements-sprint.md:70–77` records Release C, deployment `dpl_G2REeofNhSMFgHLSDczeD1MS9vMb` READY and smoke 5/5. Local Git records its commit time as **2026-10-22T22:22:10Z**. Neither is the first model issuance timestamp.

The handover F6 says “first served 10-23 (snapshot 12:30Z)”. Both Release C and current `forgeDailyBridge.ts:272–273,356` set bridge `issued_at` from **`forge_runs.created_at`**. Snapshot timing, model issuance and deployment timing are different clocks. No raw first-issued ledger/run receipt was found in the named retained artifacts; the exact issuance and successful first snapshot remain **unverified/null** in `BASELINE-RECEIPTS.json`. This task did not fill the gap with the cron schedule or a recapture.

**Around October 30 is a target, not a guarantee.** If October 23 is verified as the first complete served day and October 23–29 each have complete settled games, the next normal settlement on October 30 may provide seven days. Finality, late corrections, missing rows, no-game days or a version change can prevent that. Do not schedule or execute a check from this artifact.

## What the evaluator measures

| Question | Calculation and population |
|---|---|
| Q3 | Each full run SHA × source × player class stays separate. Primary is Release C `bridge_exact`, dressed skaters only. FP bias is mean(expected − actual); actual/expected is ratio of sums. All six nonzero-weight categories must be present, numeric and nonnegative; stored FP must match weights within 0.00011 rounding tolerance. Weighted biases use G 3, A 2, PPP 1, SOG .2, HIT .2, BLK .25, and sum to FP bias on the complete denominator. Pooled/DNP numbers are explicitly diagnostic. |
| Q4 | Expected-FP sorted, deterministic season/date/class/player/game tie breaking, PostgreSQL `ntile(10)` bucket sizes (larger buckets first). No binning on outcomes. Reports all deciles, median actual and share below expected. At least 10 complete rows are needed for a nonempty decile 10. |
| Q5 | Raw current rolling EV rows: separate absent/null, invalid and literal zero counts by game date. It has **no run git_sha and is mutable**, so its output is labeled current-state diagnostic only. It cannot be attached to historical issuance without separately retained as-of input receipts. Duplicate identities refuse the package; no silent latest/dedup selection. |
| Q6 | Raw h1 rows by full SHA, date and run ID, with count, complete-head denominator, mean FP/HIT/BLK, missing/zero counts and sum(PP A)/sum(PP G). Multiple runs stay separate. Primary target checks use the exact served run/player/game join on the dressed denominator; all-projected rows remain diagnostic. No division by zero is converted to a pass. |

Primary descriptive targets: FP |bias| ≤ .10; actual/expected .95–1.05; decile 10 .9–1.1; each category's absolute weighted bias ≤ .03; literal zero HIT and BLK fractions **strictly less than .10**; projected PP A/G in 1.8–1.91 (the handover's approximate range made explicit for this preparation). Report every target, even on an ineligible cohort, with `metric_status: diagnostic_only_ineligible` and `qualification: REFUSED`.

Controls are joined on season × served date × class × player × game, with exact known actual/participation agreement checked against independent evidence. Their unmatched counts and paired errors remain diagnostic. Native/control rows with no FORGE run are labeled `UNVERSIONED_CONTROL_OR_NATIVE`, never assigned Release C by date. The primary week refuses any missing/full-SHA mismatch or mixed-version exact cohort rather than silently filtering it. Mixed versions remain visible in separate diagnostic partitions; a future version requires a separately reviewed dated packet, not combining days to reach seven.

Historical F/D uses only approved game-time `position_at_game` evidence, with unknown explicitly retained. Goalie per-start metrics and weighted .2 SV, −1 GA, 4 W, 3 SHO are diagnostic; this packet does not qualify goalie start calibration, naive dominance, opportunity/TOI decomposition, or F/D targets. These limitations are distinct from the primary F6 skater targets. No current `players.position` substitution is made.

## Eligibility and duplicate handling

The complete contiguous calendar window starts on the **verified first served baseline day**, spans 7–14 calendar days and must contain at least seven settled game-bearing days. No skipping an unfinished early day or pooling later dates across versions. A fully documented no-game day is retained in the calendar but does not count as a settled game day.

The evaluator requires an independent complete schedule, finality/ingestion receipts, game/team dressed-player ID lists, and an independent player-game universe. Its primary dressed set must equal that universe, including players absent from every forecast source. Every exported ledger row must have known participation and settlement after finality, consistent actuals and forecast issuance before puck drop. Missing players are not inferred to be DNP; `settled_at` alone is not proof of finality or completeness.

Migration 97's key is `(served_date, player_id, game_id, source)`; it does **not** include run ID and snapshot writes upsert. `updated_at` also changes on settlement. Thus a unique current DB row does not prove it was never overwritten. Supply externally retained forecast-only hashes and complete revision histories; the script rejects any duplicate export key, repeated appearance on different served dates, changed hash, revision count other than one, or unavailable revision history. h1 rows changed after serving are also refused. No `DISTINCT`, latest-run fallback or retrospective forecast selection is used.

These proofs are not currently guaranteed by the released ledger. Release C's settle route explicitly lacks trusted finality/completeness receipts, and snapshot reports that the independent universe is not persisted. `INPUT-CONTRACT.md` separates real table fields from required external evidence; `queries.sql` cannot manufacture the missing proofs. Missing evidence means **REFUSED**, even if every numeric target looks good.

## Delivery scope and checks

Files in this directory are the entire artifact delivery; the only additional path is the task context diary. `EVIDENCE.json` records source pins, actual offline check results, changed-file hashes and zero remote actions. `VERIFY.txt` records the fixture test run. SQL is prepared and checked against local schema/types only, **not executed or query-planned against any database**. Application suites are not applicable to an artifact-only Python package. No app/schema/register/Game Grid/model/RSO/bridge files are edited.

Use `FUTURE-APPROVAL.md` for the exact conditional request. Do not execute the SQL before separate TJ approval and the required retained receipts are available. No production capture, re-capture, scheduling, migration, dependency installation, push or deploy is part of this work.
