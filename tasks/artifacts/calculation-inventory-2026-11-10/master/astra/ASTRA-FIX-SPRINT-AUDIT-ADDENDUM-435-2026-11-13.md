# Astra audit addendum 2: #435 and power ratings v4
November 13, 2026

**Verdict:** #435 closes the prior P1 version-label defect in the audited readers. The successful dry-run path is no-write and the retained evidence corroborates the completed 46-call rebuild. No new P0/P1 blocker found in this scope. Two P2 follow-ups below do not call for a rollback or rerun. This is an offline read-only audit, not a fresh production verification.

## Pins and scope

- Base `496ab37665f1098c496e4273645c897c0b9dbf4a`; release `6f1cb0767cdb91db682b9603030f0d7b4407787f`, whose sole parent is the base. The release and candidate `75dce268cef656bbc60ecef98c73861041e3ee70` have identical tree `05338a58d1d52a2e9d757c45591557e104dbafdc`.
- 41 paths changed, no migrations. Every path touched by held commits `fc34b053a`, `284f99045`, and `c89ff5d24` is unchanged from the base.
- The updated runner `9f58e0423` is a separate operational artifact, not the runner blob in the release tree. The retained local runner matches that later commit byte for byte; the event log corroborates its control flow, but does not hash the executed script.
- Release/deployment and approval records were read as retained evidence, not acted on. No repository, diary, mailbox, database or production changes or new production reads.

## Verdicts by item

| Item | Verdict and evidence |
|---|---|
| F16: Power display | **Prior P1 closed.** `teamRatingsService` selects, maps and serves calculation version and source date; the dashboard normalizer preserves them. `teamRatingVersion.ts` gates 5v5 on the exact v4 version; older/unknown values get v3 all-situations, carried source-date, or unverified labels. Card, Terminal, narrative and underlying-stats landing were checked. The two TeamPowerCard regressions fail against the #434 component and pass against #435. |
| F9: Writer dry run | **Supported for the successful path.** `update-team-power-ratings.ts:111–155,285–307,334–341` bounds the computation to one date, prevents rating upserts, and opts a successful no-op out of cron audit insertion. The wrapper intentionally still audits failures or non-2xx responses; do not describe all rejected probes as write-free. The route and shared wrapper suites pass offline. |
| F9: Runner | **Prior first-write and final-readback gaps addressed for the recorded run.** `9f58e0423` checks deployment source before writer requests, obtains a zero-upsert live probe and two dry runs, validates backup and carry manifest, checks served metadata, and fails closed on per-date/final mismatch. Source markers alone are not endpoint attestation; the retained live probe completes the check. Separate near-window race below. |
| F5b: CTPI | **Display-only boundary supported; P2 copy issue below.** The candidate predicate is additive; approved-only admission and consumer imports remain separate. Card is marked “Descriptive beta · not a forecast,” with PDO apart from score. No predictive activation. The retained 2025–26 issued-v1 reproduction gap (Pearson 0.746) remains unexplained and is not a #435 regression. |
| Cron skip item 5 | Claude independently accepted it at `aae23b0b7`; Astra did not self-review the original item. |

## New follow-ups

1. **P2, CTPI window label contradicts its warning.** The real card, with an admitted candidate and ten 5v5 rows from different dates, displays both “same 10 games” and a date-mismatch warning. The hook detects the mismatch (`useRecentTeamFormBeta.ts:309–315`), but the card tests only equal counts (`RecentTeamFormBeta.tsx:140,162–164,176–181`). Label mismatched data as a separate 5v5 sample, and say “same games” only when identity is established. Add the equal-count mismatch regression. This does not change the score or predictive gate.
2. **P2, future runner use: cron guard can go stale.** `9f58e0423` checks the window before `guard()` (runner lines 503–507), which can sleep 60–120 seconds. Recheck immediately before each mutating call after the guard returns, with a clock-crossing fixture. The recorded 16:46–16:53 UTC run was far outside the window and unaffected.

**Model handoff, not a release blocker:** `homeMinusAwayGoalieRating` now uses 5v5 where both underlying rows are v4, not for every historical matchup. `featureBuilder.ts:860–870,1877–1880,2119–2123,2749` fetches provenance but discards it in the team feature and subtracts the numeric values. Do not train or evaluate across mixed versions as if they share a definition. Version the feature and filter or withhold mixed inputs; distinguish reconstructed historical inputs from values actually issued as of that date. No active production game model is documented.

## Rebuild receipts, decisions 145/147/150

- Recomputed both 1,472-row backup hashes: identical SHA-256 `84d4ac83d69fbf2df5cc38ee85c9f7157e10c732360798bf27139b47ca9d4f8d`, 46 dates × 32 distinct teams, all pre-run v3.
- Reconciled all 47 manifest keys against the preflight CSV: 22/17/7/1 across Sept. 29–Oct. 2, all `legacy_unversioned`, source Aug. 29. The runner compares 17 copied numeric fields with a 1e-9 tolerance and excludes the two date-recomputed PP/PK tiers. Do not read “exact” as byte-identical or a tier check.
- Shared log records deployment `6f1cb0767`, clean dry runs and `PREFLIGHT_OK` with zero writes at 16:45:25 UTC. The separate execution log has 106 matching JSON events plus a plain-text exit footer. Verified all 46 dates in order, each HTTP 200 with 32 upserts and a matching readback; one guard wait, maximum call 1.4 seconds. Final zero problems and DONE at 16:53:22 UTC.
- Summed readbacks: **1,425 v4 + 47 legacy; zero v3 in scope**. Runner requires every v4 goalie value non-null; the Chef's recorded readback reports the same. Sept. 29 served check was reported as 10 v4 and 22 legacy. Raw post-write rows and served bodies were not retained here, so exact live values and UI behavior are not independently replayable from the receipts.
- The decision log records owner approval after preflight. Commit `d24bf142a` is timestamped 16:46:06 UTC, before the first logged write receipt (16:46:15); the prose rounds approval to ~16:47. Preserve the exact approval receipt if chronology matters; the approximate time is not evidence of an unauthorized run.
- The retained cron check records job 283 at 10:15 UTC / 5:15 a.m. ET. The next run was not yet observed in this audit.

## Independent focused verification

- Version-labels: 7 suites, 50 passed, plus 2 expected failures in the #434 negative control.
- Writer and shared audit wrapper: 2 suites, 69 passed.
- CTPI: 4 suites, 102 passed including the private mismatch reproduction; API suites, 121 passed and 1 existing skip. This is focused offline testing, not a full gate or hosted smoke rerun.

## Handoff for Claude (not posted)

**ASTRA-FIX-SPRINT-AUDIT-ADDENDUM-435-2026-11-13:** Prior F16 labeling P1 closed and F9 pre-write/final guard corrections supported for the recorded run. Offline receipts reconcile 46 writes, 1,425 v4 and 47 labelled legacy carries. No rebuild rerun recommended. File two nonblocking fixes: stop calling mismatched CTPI PDO rows the “same games”; recheck the cron window after the runner's load wait. Retain version provenance for future game-model feature work and keep CTPI predictive approval separate.
