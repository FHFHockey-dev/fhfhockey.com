# Astra addendum 2: release #435 and the power ratings v4 rebuild (2026-11-13)

You are **Astra**. This continues your #434 addendum (`master/astra/ASTRA-FIX-SPRINT-AUDIT-ADDENDUM-434-2026-11-13.md`) and covers its two P1s. Same ground rules: read-only; production reads only with TJ's per-batch approval under read hygiene; ask TJ by pop-up; diary; never print secrets.

## Scope
- **Range:** master `496ab3766..6f1cb0767` (PR #435), a squash of candidate `75dce268c`. Verify the tree equality yourself.
- Codex items 1, 2 and 6 are still held; confirm their paths match `496ab3766`.

## What #435 claims (verify against code and tests)
| Your #434 finding | Commits | Claim |
|---|---|---|
| P1: power readers call pre-v4 goaltending "5v5" | F16 `486b18a6f` | `teamRatingsService` and `/api/team-ratings` carry `calculationVersion` and `sourceThroughDate`. A new helper `web/lib/teamRatingVersion.ts` labels values: "5v5" only for exactly `team-power-v4-5v5-goaltending`; v3 "all situations, v3"; `legacy_unversioned` "carried from <season> · as of <source date>"; anything else "version unverified". Table headers say 5v5 only when every shown value is v4; mixed views tag each value; the narrative drops the goaltending sentence for legacy and unverified rows. Readers: TeamPowerCard, TeamPowerTerminal, teamRatingNarrative, the underlying-stats landing, `lib/dashboard/normalizers.ts` pass-through. The Chef confirmed TeamPowerCard's tests fail on #434. |
| P1 rebuild gate: the runner wrote before proving v4 | F9 `2bf3c1d26` (writer); runner `f2d275f8e`, `9f58e0423` (artifacts, not in the release tree) | `update-team-power-ratings` with `dryRun=true&date=D` computes one date, upserts nothing and skips the audit row. The runner checks the latest successful production deployment's writer source for the dry-run code **before any request to the writer**. It then probes, verifies the backup and the 47-key carry manifest, runs two dry runs, checks the served API, and only then writes, with a key-by-key readback and a fail-closed DONE. |
| — | F5b `122dd880b`, `17b342f76`, `3b6d82edc` | CTPI descriptive beta card on the team Dashboard: badge "Descriptive beta · not a forecast"; `isDescriptiveBetaCtpiPayload` is additive (`isTrustedCtpiPayload` unchanged); an import-boundary test bars projection, ranking, recommendation and model readers; PDO shown separately as puck-luck context. |

## The rebuild (production receipts; verify what you can offline)
- **Preflight** (16:45Z, no writes): deployed `6f1cb0767` passed the gate; probe v4 with 0 upserts; 09-29 dry run 10 v4 + 22 carried matching the manifest; 11-12 dry run matching the sample; served check passed. The Chef confirmed no write, no 2000-01-01 row and no audit row.
- **Run** (16:46–16:53Z, TJ "Approve, Claude runs it"): pre-run snapshot of 1,472 rows (sha256 84d4ac83…), 46 calls, all readbacks clean, DONE.
- **Chef readback:** 1,425 v4 (goalie never null) + 47 `legacy_unversioned` (source 2026-08-29, equal to each team's 09-28 row), 0 v3 left. `/api/team-ratings?date=2026-09-29` serves 22 legacy + 10 v4.
- **Files:**
  - `production/power-g5v5-2026-11-13/PLAN.md`, `PREFLIGHT.md` (§9: cron 283 at `15 10 * * *`, next run 2026-11-14 10:15Z);
  - `carry-manifest.tsv`, `run/issued-rows-2026-09-29_2026-11-13.tsv`;
  - the run log on disk at `run/rebuild-2026-11-13T1646Z.jsonl` (gitignored).
- **Decisions:** 145, 147, 150.

## Also note
- After this rebuild, the game-prediction feature `homeMinusAwayGoalieRating` reads 5-on-5 goaltending. There's no production game model (decision 42), so this is for the model project.
- Item 5: Claude's independent review accepted it (`master/astra/ITEM5-REVIEW-claude-2026-11-13.md`).
- F5 found that the issued 2025-26 v1 CTPI history can't be reproduced from current code (Pearson 0.746); the cause is unknown.

## Output
Append an "Addendum 2: #435" section with a verdict per item, findings and blockers. Post `ASTRA-FIX-SPRINT-AUDIT-ADDENDUM-435-<date>` to `CODEX-TO-CLAUDE.md`, or hand the summary to TJ if you don't write to the mailbox.
