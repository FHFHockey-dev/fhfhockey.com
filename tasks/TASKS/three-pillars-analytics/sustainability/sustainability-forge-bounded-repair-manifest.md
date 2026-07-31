# Sustainability and FORGE Bounded Repair Manifest

Date: 2026-07-30

Status: read-only preparation only. This document does not authorize a
Production migration, historical rewrite, writer call, projection run,
schedule change, or calibration change.

## Invariants

- Preserve every existing historical `forge_runs` row and projection row.
- Do not treat a requested snapshot date as an observed source cutoff.
- Do not synthesize source provenance that cannot be reconstructed.
- Keep Start Chart read-only over canonical FORGE.
- Run repairs in dependency order:
  player trends and team ratings → Sustainability provenance →
  rolling primary/support history → prospective versioned FORGE →
  projection-result disposition.
- Before every authorized mutation, retain exact pre-counts and identity plus
  payload hashes. Afterward, require post-counts, idempotent replay, unrelated
  scope invariance, and an executable inverse or retained pre-state.
- The commutative hashes below are value-free drift receipts produced with
  `bit_xor(hashtextextended(identity, 0))`. They are not content exports.

## Frozen hosted preflight

### Player trends

| Scope | Source rows | Players | Dates | Existing target rows | Existing player-dates | Identity receipt |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| 2024–25 playoff, `2025-04-19`–`2025-06-17` | 3,096 | 332 | 46 | 0 | 0 | source `6121771258224515143` |
| 2025–26 playoff, `2026-04-18`–`2026-06-14` | 2,952 | 347 | 44 | 55,404 | 2,052 | source `1546723902812409431`; target `-8919969266834811546` |

The current output has 27 metric keys per persisted player-date. A correct
playoff repair must read each season from its canonical start so cumulative and
last-N samples include regular-season history, but it may replace only the
approved output dates and metric identities.

The preflight also found a separate upstream identity defect. Exactly 1,905
`wgo_skater_stats` rows dated `2023-04-01`–`2023-04-06` are labeled season
`20242025`; the materialized `player_stats_unified` view inherits all 1,905,
and `player_trend_metrics` contains 49,410 derived rows over 1,830
player-dates under the same wrong season. There are zero corresponding rows
under season `20222023` or any other season. Receipts:

- WGO identity: `8868305476867722389`.
- Unified player/date identity: `5499108705494982642`.
- Trend identity: `5346575694005736297`.

Do not run a 2024–25 trend rebuild until this source-season scope has its own
exact repair and inverse manifest. Otherwise the rebuild would reproduce the
wrong-season inputs.

### Sustainability score provenance

Season `20252026` currently contains 264,496 score rows for 694 players over
106 snapshot dates (`2025-10-14`–`2026-07-29`), identity receipt
`7200693188241682494`.

- 11,480 rows already contain
  `sourceCutoffs.version=sustainability_score_provenance_v2`.
- 253,016 rows have no source-cutoff version and must not be presented as
  trustworthy observed-source provenance.
- 159,808 rows contain embedded `modelVersion=sustainability_score_v2`;
  104,688 have no embedded model version.
- Four historical embedded config hashes each cover 39,952 rows; 104,688 rows
  have no embedded config hash. These historical identities must be preserved,
  not relabeled as the current config.

Repair policy:

1. Preserve the 11,480 already-provable v2 rows byte-for-byte.
2. Mark the remaining 253,016 rows `legacy_provenance_unknown`; do not infer an
   observed raw date from the requested snapshot.
3. Backfill first-class model/config fields only from exact embedded values.
   Rows without exact embedded values retain `legacy_unversioned`.
4. Recompute new v2 rows only through the canonical bounded queue after the
   provenance migration is applied.

### Team ratings

The 2025–26 season spans `2025-10-07`–`2026-06-15`. The canonical table has
7,955 of 8,064 calendar-day/team identities for 32 teams, across 250 of 252
dates. Existing identity receipt: `-5134014933306894474`.

The 109 missing identities have receipt `-3798060820207542645`:

| Date | Missing teams |
| --- | ---: |
| 2025-10-07 | 26 |
| 2025-10-08 | 19 |
| 2025-12-07 | 32 |
| 2025-12-09 | 32 |

The dry run must derive the complete 252-date scope from final retained inputs,
record populated versus justified carry-forward identities, and refuse
publication if it does not produce exactly one row per approved team/date.
Historical publication needs a versioned receipt because
`team_power_ratings_daily` has no first-class model/version column.

### Rolling primary and support history

Season `20252026` contains:

- 231,295 `rolling_player_game_metrics` rows for 940 players, 165 dates
  (`2025-10-07`–`2026-04-16`), and five strength states; identity receipt
  `-7636147128100010287`.
- 48,923 `rolling_player_metric_support_payloads` rows; identity receipt
  `5511920516213307457`.

The canonical route already supports `dryRunUpsert=true`, bounded player
cursors, explicit season/date/strength scopes, and complete selected-player
history reads. The repair dry run must:

1. use `season=20252026`, explicit season dates, `executionProfile=overnight`,
   `autoResume=true`, and `dryRunUpsert=true`;
2. process deterministic player-ID batches until `nextResumeFrom` is null;
3. retain primary and support row counts plus identity/payload hashes for every
   batch;
4. require exact primary/support identity parity and zero freshness blockers;
5. publish neither table until one grouped mutation authorization quotes the
   complete dry-run receipts.

Legacy `wigo_recent` and `wigo_career` are adjacent/quarantined baselines, not
canonical rolling support tables, and are outside this repair.

## FORGE accuracy scope

The route-faithful eligibility predicate is:

- latest succeeded run per `as_of_date`;
- horizon-one skater projection;
- projected game date equals actual date;
- matching realized `wgo_skater_stats` game/player/date.

It yields 7,523 eligible skater player-games across 137 dates. Results match
6,179 and miss 1,344. The exact 21-date manifest receipt is
`1c5200feb55e0bcb6a1010650978fd52`.

| Date | Latest succeeded run | Eligible | Existing eligible | Missing | Class |
| --- | --- | ---: | ---: | ---: | --- |
| 2025-10-07 | `5683a629-74b9-407b-9513-6d3e7340748f` | 18 | 0 | 18 | zero |
| 2026-01-24 | `1155cf5c-2949-44fc-b60e-e57fa4badf2b` | 221 | 60 | 161 | partial |
| 2026-01-31 | `831cc6a6-ed66-4fd0-917c-da30c324a37d` | 339 | 69 | 270 | partial |
| 2026-02-27 | `005b541c-22b3-4550-99ce-90ffd4a503ea` | 28 | 0 | 28 | zero |
| 2026-02-28 | `f73178b0-49b8-4c57-b3de-6d30ecbe577b` | 69 | 0 | 69 | zero |
| 2026-03-01 | `6a91fc69-5315-48f4-87fc-0cb80241d261` | 33 | 0 | 33 | zero |
| 2026-03-02 | `e699e30e-32e2-4971-acd7-41f18dc733e3` | 34 | 0 | 34 | zero |
| 2026-03-03 | `b490aa96-0dc6-40a4-84bf-74b0e3513bb7` | 57 | 0 | 57 | zero |
| 2026-03-04 | `3f91f8cc-417e-46e7-8bd7-78bece4c37a3` | 29 | 0 | 29 | zero |
| 2026-03-05 | `5179e7c6-c4e0-4d8d-a7a9-e6a03b5886cd` | 39 | 0 | 39 | zero |
| 2026-03-06 | `2386f230-b55b-42f0-a6f3-57d88edfccf0` | 38 | 0 | 38 | zero |
| 2026-03-07 | `d0283d02-11a9-4bcf-8a5c-35a555572bc3` | 56 | 0 | 56 | zero |
| 2026-03-08 | `10529e52-82e0-4f68-b6a8-1e40fa4278f1` | 28 | 0 | 28 | zero |
| 2026-03-09 | `89cae371-856a-4f92-b26b-4fcfd989f8bd` | 5 | 0 | 5 | zero |
| 2026-03-10 | `947fc4b1-9b99-4289-b0b3-c026b1be4482` | 37 | 0 | 37 | zero |
| 2026-03-11 | `8accf2a0-9332-4044-834d-28ea407bc9ff` | 11 | 0 | 11 | zero |
| 2026-03-12 | `7387dbf9-e3c5-44af-a4b8-d458e0414d24` | 66 | 0 | 66 | zero |
| 2026-03-13 | `5fa6a252-b855-448a-9ff1-8c3400375530` | 11 | 0 | 11 | zero |
| 2026-03-14 | `a40bd44b-98d4-4506-a3c4-90b2efa3985f` | 74 | 0 | 74 | zero |
| 2026-03-21 | `756b206f-891d-4cca-a0b0-667a748d750d` | 279 | 0 | 279 | zero |
| 2026-04-15 | `9f490284-84d8-4510-b60e-e57fa4badf2b` | 22 | 21 | 1 | partial |

The 18 zero dates account for 912 missing rows; the three partial dates account
for 432. The full target date scopes currently contain 309 result rows
(299 skater, 10 goalie) from three source runs:

- target identity receipt `1184322629810289960`;
- target payload receipt `8725786774048935438`;
- unrelated 6,932-row identity receipt `-8709483987125723559`;
- unrelated payload receipt `-7724181989307097579`.

## FORGE execution blocker

All 21 latest succeeded runs lack
`metrics.input_provenance.rolling_player_history_contract =
full_selected_scope_through_end_date_v1`. Therefore both the current accuracy
route and `replace_forge_projection_results_atomic` correctly reject them.

Do not weaken this guard, stamp legacy runs retroactively, or rewrite their
projections. Before any result write, the owner must choose and document one
coherent disposition:

1. retain the 21 scopes as explicitly excluded contaminated history with no
   backfill; or
2. introduce a separately versioned, non-calibration historical-result class
   that cannot enter calibration/promotion and does not alter original runs or
   projections.

The existing instruction to exact-replace these results cannot execute under
the simultaneously approved contaminated-run exclusion without that decision.

## Authorization package

An eventual mutation request must quote:

- exact migration filenames and hashes;
- each approved table/date/season/player scope;
- dry-run row counts and identity/payload receipts;
- expected first-run insert/update/delete counts;
- physical replay expectations;
- unrelated-scope receipts;
- rollback SQL or retained pre-state;
- the resolved FORGE contaminated-history disposition.

No mutation request is ready until the source-season defect, versioned
trend/team publication receipts, and FORGE disposition are implemented and
proved locally.
