# L9c · FORGE coverage path: a projection for every eligible player (new lane, 2026-11-12)

**Stage 4, producer side of W1 P0 #27 and decision 132 (points 2–4).** Consumer side is L11's. Read `_COMMON.md` first. Codex reserved `web/lib/projections/**` on 2026-11-04: do the claim step and stop if Codex actively claims a file.

## Owned files
L9a's former files that this needs (L9a is closed): `web/lib/projections/stages/skater-stage.ts`, `stages/preflight-stage.ts`, `queries/skater-queries.ts`, `rosterEvents.ts`, `nativePlayerCoverage.ts`, `nativePlayerCoverageKernel.ts`, `skaterRollout.ts`, `nativeSkaterParticipationResearch.ts`, `privateParticipationScenario.ts`, `uncertainty.ts`, and their tests. **Not** `reserveProjections.ts` or any goalie file (handed to Codex: write proposals to `CLAUDE-TO-CODEX.md`).

## Findings and decisions
| ID | P | Reach | Fix | Source |
|---|---|---|---|---|
| W1 P0 #27 root cause | P0 | live | Find and fix why eligible skaters get no FORGE line (101 of 673 reported, lineups frozen since 2026-11-09 by held runs): trace the eligibility and selection path from source; every eligible player, including injured players and long absences, gets a projection (decisions 3, 47, 132.2). | BC §W1-11 B (D2); decision 132 |
| Decision 132.2 | P1 | live | Distinct "if he plays" line for every eligible player. A returning player's rates come from his last active games, with a **time-away decay that widens uncertainty**: fitted and validated on held-out returns (rules 11, 12), never a fixed-rate decline; until validated, label it unvalidated. | decision 132 |
| Decision 132.3 | P1 | live | Availability separate from the line: confirmed out → 0.0 expected for that game, with the if-active line kept; uncertain → a qualified participation probability, labelled; missing data never becomes a confirmed 0. Use L9a's scratch/RETURN contract (0b7c8b04e). | decisions 31, 132 |
| Decision 132.4 | P1 | live | Coverage path validated end to end: eligible universe → line → availability → served row, with a coverage report (eligible, projected, unknown and why). Reserve projections: proposal to Codex. | decision 132 |

## Rules and traps
Rules 5, 7, 11, 12, 18, 22, 25. Prove on the final serialized payload. Never zero an unknown. Any validation that needs production data comes as an exact bounded read for Chef/TJ approval (read hygiene).

## Production steps (TJ approval)
FORGE rerun after release; any migration (via L4a) or backfill; reconcile held rolling/FORGE writes first.

## Done
Every eligible player gets a projection with an if-plays line and a separate availability state; root cause of missing lines fixed and evidenced; coverage report; decay labelled unvalidated or validated on held-out data; Codex reserve proposal filed.
