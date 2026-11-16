# xG trainers and baseline tests

Full frozen `89da739cb` read: baseline trainer 2,189 lines, its tests 1,077 lines, rich rebound trainer 336 lines. No trainer, dotenv, client, real artifact, supplied test suite or fitting operation executed. Exact extracted helpers and finite transport/filesystem doubles passed in `scripts9-probe-output.json`. One harness binding initially wrapped an extracted import unnecessarily; corrected the harness only, then passed once.

## AFULL-XGTRAIN1-01 — P2: unpaged handedness history silently loses players

- **Location/claim:** `web/scripts/train-nhl-xg-baseline.ts:1111–1195`; each 200-player shooter/goalie query must account for all requested identities before claiming the feature cohort.
- **Evidence/scenario:** both readers order all season history by player then descending date, with no paging, exact count or truncation check. The frozen local API configuration caps results at 1,000. An exact capped-client fixture with six requested players and 200 history rows per player returns only players 1–5; player 6 is absent without an error. This is a synthetic cap scenario, not a new production read or a claim about the current view's observed cardinality.
- **Fix/readers:** request latest qualified row per player through a bounded indexed reader, or page deterministically and verify completeness. Preserve absent/unknown hand separately from a truncated read. Affects handedness/matchup features, coverage and resulting baseline/challenger datasets.

## AFULL-XGTRAIN1-02 — P2: different input cohorts overwrite the same artifact path

- **Location/claim:** baseline trainer:735–762, 1328–1331, 2098–2120 and 2158–2159. Diagnostic provenance must retain the inputs that produced the model.
- **Evidence/scenario:** the config signature omits explicit game IDs, game limit, reference dataset identity and input bytes. Two otherwise identical runs for games 1 and 2 have the same tag/output directory; the exact artifact writer, with an in-memory filesystem, replaces `rowIds:["1:1"]` with `["2:1"]`. Ordinary `writeFileSync` has no exclusive-create guard. No existing artifact was overwritten in this audit.
- **Fix/readers:** bind actual input/cohort content and reference identity into an immutable run directory, or refuse overwriting an existing artifact. Affects retained dataset/model files, benchmark inputs and later provenance references. This does not assert modification of issued production history.

## AFULL-XGTRAIN1-03 — P2: malformed explicit bounds fall back to all games

- **Location/claim:** baseline trainer:546–554, 586–680 and 968–976. An explicit limited diagnostic must reject malformed limits rather than widen its database scope.
- **Evidence/scenario:** `--gameIds not-an-id --limitGames not-a-limit` becomes `gameIds:null` and a NaN limit. The exact selector then retains all three supplied season games; the fetch path consequently takes its whole-season branch. A valid explicit ID/limit control selects only the intended game.
- **Fix/readers:** validate every supplied ID and positive integer cap, distinguish omitted from invalid, reject unknown/duplicate flags, and require an explicit bounded plan before external reads. Affects operator query volume and reproducibility; no malformed command or real query was run.

**Existing AFULL-XGREB1-01 P2** is inherited by the rich rebound trainer at line 262: the shared label builder's generic stoppage proxy is fed into the goalie-freeze head. The output labels this as a proxy and hardcodes `promotionAuthorized:false`; that does not make cause-specific labels validated. No live retired champion was served: `cfg9bac2706` appears here only as the frozen reference dataset's default path.

Reviewed all numeric definitions: train-only population standardization and constant-column fallback, grouped chronological game assignment, optional season holdout, actual selected-feature transforms, validation-only calibration, served booster probability-space scoring, six-decimal diagnostics, per-slice aggregation, held-out test-only approval, convergence blocker, forbidden post-event features, rebound evidence floors, tie-midrank AUC and train-base-rate comparisons. Hand-scored Brier 0.5625, empty unknown metrics, train-only mean/std, tied AUC 0.5 and perfect AUC 1 passed finite controls. No scientific performance qualification is inferred from these plumbing checks.

The baseline tests use independently generated Bernoulli labels for the approval gate, but inject them separately from the four-row dataset fixture. This tests gate behavior, not raw-row provenance binding. The normal main path builds scores from the same transformed dataset; arbitrary reference-artifact integrity, real source completeness and reference metadata matching remain unverified. The rich trainer consumes supplied game-level assignments without validating their chronology, tolerates missing feature rows with a counter, and uses a small offline gate without convergence/calibration qualification; its explicit no-promotion boundary must remain.

| Script | Bounds / stop rules | Resume and gating |
|---|---|---|
| train-nhl-xg-baseline | 1,000-row pages, 20-game PBP/shift chunks, 200-identity enrichment chunks; some season enrichment runs concurrently. Optional IDs/limit; no total read/time cap or load hygiene. Stops on query/validation errors. | Reconstructs reference IDs/order and verifies row count; no input-content freeze or resumable receipt. Local artifact output only, explicit separate registry promotion remains required. Loads dotenv on import. |
| train-nhl-xg-rebound-heads-offline | 20-game chunks, two concurrent paged feature/PBP reads, 1,000 rows/page; finite 500-iteration fit; no total read/time cap or load hygiene. Errors stop main. | Source feature and strength versions are bound; parser version fixed at 1. Hashes source artifact/reference, emits offline-only/no-promotion output; no dry-run/resume and overwrite is possible. Loads dotenv and invokes main unconditionally, despite the offline name. |

Neither script name nor local output authorizes production reads. Any actual run remains subject to TJ's exact-batch approval and read hygiene.
