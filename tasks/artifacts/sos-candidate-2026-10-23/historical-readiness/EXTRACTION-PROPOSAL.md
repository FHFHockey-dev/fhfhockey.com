# Minimal retained-data availability proposal

Status: prepared locally, **not executed and not approved for production reads**. The candidate needs data eligibility, not more synthetic tests. No ingestion, refresh, historical backfill, model capture, provider request, dependency update or deployment is proposed.

## Stage A: three bounded read requests

Target: the existing FHFH `public` schema, after verifying the intended connected project against the canonical repository's linked project reference. Use `availability-preflight.sql` as a reviewable query specification; do not execute it through application routes. A reviewer must confirm its exact target before dispatch. This lane did not read credentials or connect to a database.

Proposed season is **20252026**, a completed historical season represented in retained source-audit documentation. This is a coverage probe, not a commitment to use whatever data happens to score well. Observation ceiling is fixed at **2026-10-23T00:00:00Z**.

| Read | Exact scope and fields | Accepted output bound |
|---|---|---|
| Q1 | Definitions of seven named relations: games, teams, seasons, raw game payloads, season schedule headers, season schedule fixtures, per-game schedule revisions. Return relation presence/kind, columns/types, indexes and triggers. | Seven rows; missing/incompatible definitions stop later execution. |
| Q2 | Season schedule headers: ID, season, source, observed/available/created times, completeness, revision hash and manifest-entry count. No fixture payloads or player/user data. | At most 64 headers; LIMIT 65 supplies a sentinel. No automatic pagination. |
| Q3 | Current regular-season game identity/date/start/team fields and the earliest stored FINAL/OFF boxscore's row ID, hash, fetched/created times, state and payload identity/season. No scores or winners. | At most 2,000 games; LIMIT 2,001 supplies a sentinel. Missing terminal evidence remains null. |

Use one read-only transaction, sequential execution, **10-second statement timeout**, **one-second lock timeout**, **2 MiB maximum combined output**, and no retry. The runner must inspect Q1 before issuing Q2/Q3; the SQL file is a specification, not an invitation to blindly batch past a failed prerequisite. If output reaches a sentinel, exceeds the byte cap, times out, has conflicting identity, or needs a missing field, stop and retain the failure receipt. Do not expand dates or choose a convenient truncated prefix.

Estimated database reads: **three SELECT requests**, not three physical page reads. Q3 performs indexed per-game terminal-version lookups, potentially examining multiple stored versions. Source indexes cover game/endpoint/fetched time and season/date/endpoint. The query plan, scanned rows/pages, cache use and monetary cost remain unmeasured. Limits bound returned output and elapsed statement execution, not all server I/O. No promise of zero cost is made. No `EXPLAIN ANALYZE`, ingestion route or extra automatic count query is authorized by this proposal.

## Stage B: conditional row export, separate approval-ready refinement

Only after Stage A establishes a viable window, pin at most **four cutoffs** by a stated coverage rule, before seeing outcomes or scoring methods. Require a full cohort, eligible result history, a genuinely pre-cutoff complete future schedule, and mature 7-day and 28-day follow-up. Prefer nonoverlapping 28-day windows for the initial bounded pilot; if historical retention cannot supply four, report the shortfall rather than relax the contract silently. Predeclare which dates are development versus untouched evaluation; no held-out tuning.

Expected additional reads: **up to three bounded exports**, with exact row-ID allowlists to be written after Stage A. Export (1) canonical cohort/season identities, (2) at most four selected complete schedule snapshots and their fixtures/manifests, and (3) the distinct archived result revisions needed for the four cutoffs and later outcome labels. Maximum accepted sizes: 64 team IDs, 2,000 canonical games, 8,000 snapshot-fixture rows, 8,000 result revisions, **16 MiB combined output**. These are conservative caps, not estimates of actual records. If the exact selected payloads exceed them, stop and amend the proposal; do not strip provenance to fit.

Do not export every raw player-level boxscore by default. Use a reviewed allowlist of result fields after inspecting a small selected payload for identity, finality, outcome category and end-time evidence. Preserve source row/hash identity and independently hash the exact normalized export bytes. Full raw payload verification may require a larger separately bounded export; current metadata does not prove that arbitrary JSONB reserialization matches the producer's original JSON hash.

The existing candidate requires exact `end`. If retained source offers only a terminal-observation upper bound, stop admission and propose a named conservative completion-bound contract extension. Do not silently set actual end equal to fetch time. No extension is implemented in this packet.

## Interpretation and evaluation gate

The first comparison needs no existing power table. Freeze final-win credit and demonstration priors as a **baseline specification**, not an optimized NHL setting. Compare direct excluded opponent records, the specified RPI-style blend, and leave-focal-out Colley on identical fixtures, cutoffs and cohort. Keep global fitted quality separate. Prior/outcome sensitivities must be declared before viewing evaluation outputs.

At the qualification stage, report admissible fixtures, completeness, prior-only exposure, graph components, version timing and excluded reasons. These are data checks. A predictive experiment additionally needs a legitimate calibrated outcome mapping or a separately defined fantasy-category target. Do not score raw Colley as a probability or equate correlation with opponents' subsequent records to recovery of true latent quality; their subsequent schedules also confound that proxy. Freeze chronological fitting/calibration on earlier data and preserve an untouched evaluation block. No universal winner or numeric promotion threshold is chosen by this availability proposal.

For eventual 4WG/WeekScore ablations, hold GP, off-nights and crowding fixed; any opponent term replaces the existing matchup term in a separately approved shadow experiment. No extra generic SoS multiplication of already matchup-conditioned FORGE output.

## Decision sequence

1. Check whether another durable copy already contains the manifest's required revisions; the new task-8 derivative is useful provenance evidence but does not meet them.
2. If no local qualified cohort exists, approve or decline **Stage A only**, with exact project, SQL hash and caps. This document itself grants no authority.
3. Inspect coverage and temporal semantics. If suitable, finalize the exact Stage B IDs, bytes and evaluation protocol before exporting/scoring. If not, document whether historical archives can repair the gap. New collection would help future validation and cannot recreate unavailable past vintages.

This keeps the next decision small. It does not ask TJ to attach a bundle already present locally and does not let Library delivery block research.
