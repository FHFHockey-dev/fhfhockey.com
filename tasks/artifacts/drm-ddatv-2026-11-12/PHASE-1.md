# DRM DDATV — inventory and data checkpoint

2026-11-12. Canonical checkout `octoberBranch`, initial HEAD `73a199dc0c671caaadd14797f990a011adda2434`. This is an interim evidence map, not completion or release acceptance.

**Later checkpoint:** `UI-HISTORY-CHECKPOINT.md` records completed local calendar/TOI/card/history work. The source owner's updated `../drm-pipeline-triage-2026-11-12/MATH-AUDIT.md` supersedes the clock-failure findings below: the five-game qualified replay now passes; all 21 candidate hashes match. Production remains unrepaired. The sections below preserve the initial evidence as observed, not current local-code status.

## Current state, independently checked

- Production alias `fhfhockey.com` resolves to READY deployment `dpl_137qFEpUhovkj9Q6NaPbD4jAHNzP`, master SHA `631a00c1988dc7acc294573bec9ad8f08c9e3e12` (PR 430). The older lease-release note saying PR 430 was open is superseded by this metadata observation. No application request or build was triggered.
- Read-only activity guard: 2 active queries, none over 10 seconds or waiting for a lock. Subsequent diagnostics were bounded to three cron IDs, three migration versions, two game IDs and one player-game. No full-population rescan, provider fetch or mutation.
- Cron 363 is active at 09:45 UTC, 16 at 09:55, 305 at 10:05. The prior approved schedule repair is live; this does not verify the next automatic run.
- Migration ledger contains `20260720105524`, `20261109034000` and `20261112130000`. Presence establishes recorded application, not independent body verification of every RPC. The first two relevant RPC bodies were captured in the prior triage's `LIVE-RPCS.sql`; no schema change is needed for this audit.
- Game 2026020009 is input/relationship complete under input v1 and relationship v3. Woll (8479361) remains 68:06 TOI against game length 63:23, split ES 57:28 / PP 2:18 / PK 8:20. The physical bound fails in current stored data.
- Game 2026020298 has complete v1 inputs, relationships pending, and 38/38 rows missing both relationship clocks. The aggregate-reader local repair excludes these rows/games rather than inventing zeros.
- All source hashes in the prior triage `CANDIDATE.json` matched the current files at this checkpoint. Its earlier verification is reused only for those pinned files, with strength qualification explicitly failing.

Evidence: `deployment.json`, `db_guard.json`, `db_phase1.json`, `db_status.json` beside this report. Prior population counts and NHL comparisons are historical evidence from `../drm-pipeline-triage-2026-11-12/`, not fresh scans in this chat.

## Source-to-display inventory

| Boundary | Owning source | Meaning / confidence / gap |
|---|---|---|
| NHL shift/PBP/boxscore/landing capture | `web/lib/supabase/Upserts/nhlRawGamecenter.mjs`, `nhlRawGamecenterRoute.ts` | Immutable raw snapshots and normalized roster/events/shifts. Prior triage verified exact captured-game lineage and installed RPCs. Provider correctness is not guaranteed by envelope validation. |
| Projection input normalization | `web/lib/projections/ingest/shifts.ts`, `projectionInputPersistence.ts` | Canonical player/team/period interval unions locally correct duplicate/overlap inflation while retaining raw hashes. Played-period bounds validated. v2 correction is local; sampled live games still v1. |
| Strength exposure | same `shifts.ts`, `web/utils/getPowerPlayBlocks.ts` | Current event carry-forward misallocates seconds after penalty expiry. Candidate replacement also fails penalty-shot/serial-service probes. Full strength qualification FAILS; total conservation does not validate ES/PP/PK. Prior owner is finishing this work. |
| Pair relationships | `web/pages/api/v1/db/shift-charts.ts`, `shiftChartRelationshipPayload.ts`, `relationshipMaterialization.ts` | Pairwise intersections of canonical unions, all strengths, integer seconds. Per-game inferred labels and relationship clocks are separate from input-owned strength totals. Transactional generation checks avoid publishing stale combinations. |
| Storage | `shift_charts`, `projection_game_materialization_status` | Pending relationship clocks are intentionally null after new input generations. Legacy `es_shifts` means non-PP (includes PK); it cannot supply exclusive ES. Current rows alone do not prove full expected roster/game coverage. |
| Aggregate reader | `web/components/DateRangeMatrix/fetchAggregatedData.ts` | Explicit canonical team/season/game type/date filters; paginated rows; ID/duplicate/mirror/bounds validation; complete game exclusion for invalid TOI. Reads all-strength relationships, not strength-specific pairs or simultaneous units. Card stats queried only for accepted game/player scope. |
| Raw QA reader | `web/components/DateRangeMatrix/useTOIData.tsx` | Also reads derived `shift_charts`, not original raw NHL shifts. Different null/fallback policy; label can suggest stronger independence than it provides. No materialization-version qualification read. |
| Window selection | `web/pages/drm.tsx`, `DateRangeMatrix/utilities.ts` | L7/L14/L30 currently mean fixed last N games from `wgo_team_stats`; fewer than N returns no window. User goal now explicitly requires calendar days. Season Totals currently uses configured season end rather than a capped season-to-date end. |
| View and assignment | `useDateRangeMatrixData.ts`, `lineCombinationHelper.ts`, `index.tsx`, `LinePairGrid.tsx` | Weighted label counts choose a pivot; pairwise totals choose partners. This is synthetic inference, not measured simultaneous trios. Total TOI currently sorts ATOI. No strength selector or PP-unit view in DRM. |
| Historical report sources | current `/lines` projected-lineup reader and source/claim stores | Separate reported/projected evidence exists; no historical date-range reader wired to DRM. Source inventory in progress. Do not use a report as observed deployment. |

## Data quality findings and affected features

1. **Proven live:** impossible total TOI remains stored; pending games still lack derived clocks. Current line ranks, pair shares and cards depend on admission of corrected data. Local exclusion is protection, not a source repair.
2. **Proven prior captured-data/fixtures; current pins match:** physical union correction works in the five retained game replays; PP/PK clock qualification fails. ES-only and PP/PK views must not claim measured accuracy before that dependency is fixed and historical generations repaired.
3. **Proven code:** pairwise totals cannot identify the most-used simultaneous three-player unit. Across games, the selected three players can have zero three-way shared time. A new observed-unit data contract is required, not just pivot reweighting.
4. **Proven code:** reader coverage counts received/skipped rows, not expected completed games or expected dressed roster. An entirely absent game is invisible to this denominator. The UI must distinguish missing games, pending materialization and accepted games before claiming complete range coverage.
5. **Proven code:** L7/L14/L30 and Total TOI labels do not match this goal's requested meanings. These UI/window repairs can proceed independently of producer ownership.
6. **Unverified:** current provider-wide completeness, all deployed function bodies, historical report coverage and live UI results. No evidence of full accuracy is inferred from a loaded page or passing fixture.

## Dependency-aware work order

- A. Finish data inventory and isolated UI observation; preserve prior-owner files until explicit handoff (user confirmed that chat is still finishing).
- B. Correct calendar-day/season-to-date windows and total-TOI ordering; prove boundaries and rendered results locally. Audit existing inferred grouping independently with hand-checkable examples.
- C. On handoff, review qualified exposure clock and exact producer/reader generations. Establish expected-game/roster coverage. Define and implement simultaneous observed-unit aggregation, preserving reported/projected evidence separately.
- D. Add strength-specific matrices and separately measured ES/PP presentation, historical report browsing/source links, error/partial states and source-to-display tests.
- E. Complete local verification and a reviewable release/repair plan. Commit/push/deploy, provider ingestion, production migrations and backfill remain separately authorized operations. Historical repair scope must include strength defects; the earlier 92-game overlap/pending list is not the full strength scope.

No application source changed by this chat at this checkpoint. No commit, push, deployment or production mutation. Scope is still active and unfinished.
