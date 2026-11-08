# Pending provenance scope: proposal for Astra (NOT implemented)

Status at the checkpoint, 2026-10-26: the skater-consumer guard is committed locally (9eb4f0d36). Its step 2, the exact verified-SHA fallback, is uncommitted work in progress (see CHECKPOINT.md). Expanding the guard to teams, goalies or game predictions has **not** started. TJ explicitly paused it for this audit.

## Background facts (sources cited)
- **Policy (TJ, 2026-10-26):** FORGE and its consumers must never use the draft dashboard's third-party pundit projection tables (`PROJECTIONS_*`). They are allowed only on `/projections` and `/draft-dashboard`. See memory `forge-no-fantasy-projection-tables`, and mailbox CLAUDE-20261026-100/101.
- **Removal:** commit 7007a0527 removed the fantasy branch from `loadSeasonBootstrap`. It was released as master `538100d41ee87e721d2764b694f7bac8c2f2bb34` (PR #385, deployed 2026-10-26 02:16Z). Before 7007a0527, both skater bootstrap calls passed `allowCurrentFantasy=true`, and the goalie call passed `false` (`git show 7007a0527^:web/lib/projections/seasonBootstrap.ts`; audit TRACE-NOTES §4).
- **Proof today:** the writer claims `external_fantasy_input_contract = excluded_from_native_inputs_v1` only on captured snapshots and revisions (`run-forge-projections.ts` around :565). Run-start `forge_runs.metrics.input_provenance` is unclaimed (around :699).
- **Bounded production read** (TJ-approved; 2 of ≤3 read-only queries, 2026-10-26; PROD-READ-PLAN.md):
  - Q1: two released runs since 02:16Z (`git_sha 538100d41`, as_of 2026-10-26 and 2026-10-27), with **no** `forge-run-inputs-v1` snapshot.
  - Q2: **zero** such snapshots since the cutoff, so production Starter Board capture is off.
  - Q3 was not run.
  - Releasing the committed guard alone would therefore withhold all FORGE skater output. It is **not** released.

## Proposed admission rule (under construction for skaters; proposed for the wider scope)
Accept a run's output only if one of these holds:
1. **Captured-input proof** exists: `player_forecast_source_observations` (provider `forge`, dataset `forge-run-inputs-v1`, `entity_key = run_id`) with a valid version, a matching runId, the exclusion contract, and a valid `capturedReads` receipt. This is the same proof `consumerRevisionAdmission.ts:88` trusts.
2. **Or** the run's recorded producer SHA is on an allowlist of exact, full-length, individually verified release SHAs. Verification means an offline check of that exact tree's FORGE import closure, including fallback and data-loading paths, showing no pundit config or table reference. A receipt is stored per SHA. Under TJ's rules, only 538100d41 is proposed so far.

Reject older, unknown, missing, short, prefix or `local:` SHAs. **No blanket trust for later commits**: every release needs its own verification.

## Concerns Astra should challenge
- **Absent vs contradictory vs failed proof.** An allowlist may stand in only for *absent* captured proof. If captured proof exists and contradicts (a fantasy source is read, the contract is missing, or the receipt is invalid), or the proof read fails, the run must be refused **even if its SHA is allowlisted**. Verify the step-2 implementation enforces this ordering.
- **Cross-version resume.** `forge_runs.git_sha` comes from the executing deployment (`run-lifecycle-queries.ts:250`: `VERCEL_GIT_COMMIT_SHA` → `GIT_SHA` → local-unknown). FORGE runs are resumable, so a run started on one deployment and resumed on another may have rows written by several code versions, while the run records one SHA. The rule must require evidence that **every contributing invocation** ran a verified version: same-version resume, or per-invocation attribution. Otherwise treat the run as unproven.
  - **Partial mitigation already in cd73cbd69:** the verified-release path accepts a snapshot-less run only when its recorded `invocations === "1"` (`externalInputProof.ts` around :64), so multi-invocation runs fall back to unproven.
  - Astra should verify that `invocations` is written reliably by every resume path. It should also confirm that a single recorded invocation really means a single writer, and decide whether same-version multi-invocation runs deserve acceptance with per-invocation SHA evidence.
- **Attribution trust.** `GIT_SHA` and `FORGE_CODE_VERSION` (`run-forge-projections.ts:482`) can be set manually. Decide whether only the Vercel-provided SHA counts.
- **Don't promise today's runs qualify.** The two 538100d41 runs qualify only if 538100d41's tree verifies and the resume concern is settled for those runs.

## Scope to audit beyond skaters (C7 R39 G1 and TJ's handoff instruction)
| Surface | Path(s) | Why in scope | Notes |
|---|---|---|---|
| Team projections API | `web/pages/api/v1/projections/teams.ts`; explicit-run check reads `forge_runs.metrics` (always 422) | Team rows are summed from skater lines **after** the season-prior blend (`skater-stage.ts` teamTotals follow seasonLine), so pre-removal team projections inherit the pundit influence | latest, fallback and explicit paths |
| Game predictions | `web/lib/game-predictions/featureBuilder.ts:2912` reads `forge_team_projections` as model features | A derived consumer of possibly blended team rows; also check training and calibration datasets built from them | include caches and stored prediction rows (preserve history) |
| Goalie projections | `web/pages/api/v1/projections/goalies.ts`; `web/pages/api/v1/forge/goalies.ts` (latest + fallback) → command-center goalie card, `dashboard/dataFetchers` | **Distinct producer path:** the goalie stage always called `loadSeasonBootstrap(..., false)`. Absent proof must not be labelled contamination. Assess the goalie producer separately | decide the rule on evidence, not absence |
| Already guarded (verify) | RSO bridge, served-forecast ledger, Start Chart legacy, apiHelpers latest, `/forge/players`, `/projections/players` | committed in 9eb4f0d36 | C7 R39 G2/G3: an older proven run substituted silently; 20-run candidate window |

## Unresolved questions for Astra
1. Is the verified-SHA fallback acceptable at all, or must capture be enabled (`STARTER_BOARD_CAPTURE_ENABLED` and `STARTER_BOARD_COMPUTE_ENABLED`, with serving still off) so proof is first-class? Capture activation is **not** authorized now.
2. How should the resume concern be closed: per-invocation SHA logging, refusing mixed-version runs, or capture?
3. Should teams and predictions be gated, recomputed, or labelled? How should historical stored predictions be treated (preserve, never serve as clean)?
4. Goalies: is a producer-path proof (the goalie stage never read pundit tables) sufficient, given that goalie inputs include team context derived from skater lines?
