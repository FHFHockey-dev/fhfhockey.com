# SoS historical-data prerequisite — local checkpoint addendum

The offline candidate remains mathematically accepted within its declared scope. **No inspected local cohort qualifies for a historical as-of NHL comparison.** No predictive validation, new capture or model experiment was run. This addendum does not change candidate code, Game Grid Opportunity, WeekScore or any application file.

## Evidence found

- The planner export contains 22 dates and 32 teams. The local inventory checks reciprocal team/date cells and per-date game counts; these establish calendar consistency only. The cells contain opponent and home/away, without canonical game IDs, exact starts, outcomes, final-result revisions or historical publication evidence.
- The earlier FORGE capture manifest names 62 files in each of a/b/a0/b0. **All 248 recorded paths are now absent**, as is its raw audit extract. The prior continuation checked only one file per variant; this recovery completed the full path-existence check. The retained calibration JSON is a summary, not a replacement for those inputs.
- Parent identified a durable 62-file directory in task-8. All 62 files exist (1,084,858,452 bytes). Its transformation manifest says `derived_retrospective_evidence`, `heldout=false`, `prospective=false`, `exactRecordedQueryReplay=false`. Two bookend files were inspected and their hashes match that manifest. They were acquired on October 22 for October 13 and October 20 declared input cutoffs. The other 60 payloads were not parsed or hash-verified by this lane.
- Those 62 original capture hashes have **zero overlap** with the earlier 248-file manifest. This is a different capture cohort, not recovery of the missing originals. The two sampled files have partial game queries, one target-game score row, latest-only `nhl_team_data` fallbacks and aggregate team histories. They do not supply a full season/cohort result ledger or retained forward schedule versions. A declared old input cutoff does not backdate acquisition.
- Two-game counterfactual fixtures are consumed by unit tests, with test IDs/run labels. They are not an empirical NHL cohort. Retained sKO Parquet files have explicitly unknown run provenance in their ownership contract; they are not admitted as timestamp-qualified SoS evidence. No Parquet decoding, fitting or inference was performed.

`LOCAL-INVENTORY.json` contains exact paths, hashes, dates, field inventories and inspection limits. `SOURCE-PINS.json` pins the supporting repository sources. The scope was named retained artifacts, their referenced paths, the parent-supplied durable directory, relevant output names and schema/writer/reader definitions. It was not a whole-machine data search; an unlocated archive may exist elsewhere.

## A better existing extraction path

`nhl_api_game_payloads_raw` is a useful result-version candidate. The checked-in schema has `id, game_id, endpoint, season_id, game_date, payload_hash, payload, fetched_at, created_at`; uniqueness includes game, endpoint and payload hash. Checked-in triggers reject updates and deletes. The writer uses `ignoreDuplicates:true` and a real fetch timestamp, preserving the first stored observation of identical content. The existing baseline reader retrieves metadata by game and cutoff before selecting payload IDs. These are source-code findings, not confirmation of deployed schema or populated history.

An archived terminal boxscore fetched before a cutoff could establish that those final contents were known by then. A final boxscore fetched after the cutoff cannot. The next preflight should discover early terminal observations before requesting a new historical export; it must never call the ingestion endpoints.

The schema also has immutable `player_forecast_season_schedule_snapshots` and child games, plus per-game schedule revisions. The importer sets observed/available times from `manifest.freezeCreatedAt`. A freeze manifest and completeness claim therefore need verification; `completeness=1` alone is insufficient. `games` is the current schedule/identity table, with no result or end-time fields in the inspected definition. Its `created_at` does not version later schedule changes.

External team-strength snapshots are **not required for the first direct/RPI/Colley comparison**: those methods estimate quality from results. `team_power_ratings_daily` is an optional later comparator. Its writer upserts by team/date, so date, creation time and source-through date alone cannot recover overwritten historical values. `nhl_team_data` remains unsuitable as a historical source because its inspected definition exposes latest standings and mixed-season joins.

## Exact temporal issues to resolve before comparison

1. Admit the specific result revision only when observed/available before the cutoff. Use the retained state at that time, not a later correction with its original game date.
2. Establish a full regular-season cohort and all results available through the cutoff. Partial per-team query windows cannot be silently combined into a complete league graph.
3. Establish the future fixture list as known before the cutoff, including postponed/cancelled/revised games and the full requested horizon. A later final schedule creates fixture-selection leakage even without leaking scores.
4. The current candidate requires a game `end` timestamp. The inspected metadata does not prove actual end instants. A terminal observation can supply a truthful **completed-before bound**, but it must not be relabeled as exact actual end. If exact end is unavailable, a separately reviewed adapter/contract extension for a conservative bound is needed; no current formula or contract was changed here.
5. Raw payload hashes were created from `JSON.stringify(payload)` before JSONB storage. JSONB/export serialization may reorder keys. Preserve the stored identity hash and compute a new exact export-byte hash; do not claim an arbitrary reserialized export reproduces the original raw hash. Any raw-hash verifier must match the producer's serialization/provenance contract.
6. Preserve outcome categories and phase. Do not infer OT versus shootout from final score alone, reconstruct actual exceptional points from ordinary rules, or use present-day relocation mappings without season provenance.

## What can be learned without new capture

The existing calendar can support date/opponent/volume and fixture-weighting demonstrations. The durable derived inputs can support inspection of source omissions and historical reconstruction mechanics. Neither establishes historical pregame skill.

If retained terminal versions and schedule freezes already exist, exporting them requires no new provider capture and could unlock an honest as-of comparison. If only today's final histories exist, they can support a distinctly labeled retrospective reconstruction and sensitivity analysis, not a replay of what was known at the time. Missing historical revisions cannot be manufactured by a new backfill.

`DATA-MANIFEST.json` defines the minimal target inputs. `EXTRACTION-PROPOSAL.md` and `availability-preflight.sql` give the next bounded read-only proposal. **No SQL in this addendum was executed.** The proposal is not production-read authorization.

## Next blocker and decision

The substantive blocker is absence of a verified complete result/schedule vintage cohort in the inspected local evidence. Recommend the bounded availability preflight against existing retained storage before asking for new captures or fitting a model. Its historical season is proposed explicitly; a different season or larger bound requires an amended proposal. The user need not attach this lane's own existing bundle.

Library upload remains independently blocked by the earlier DNS/TLS failures. That does not block local research. Executor transport recovered during this continuation; no process is pending and no restart/network change was attempted. See `CHECKPOINT.md` for exact resume steps and preserved failure evidence.
