# SQL source audit: authority135–141

2026-11-14 · worker actual `gpt-6-astra/high` · target `89da739cb45d7d572ed59bfa0b209c79c5d99299`. Chef owns finding acceptance and integration. Seven migrations read fully in path order, then six paired Python proofs and seven rollback sources:20 assigned files. Source review complete; SQL runtime **not run**, already blocked by sandbox shmget denial in batch125–134. No new bootstrap attempts, DB connections, remote/provider/page calls, source changes or migrations. Pure static/arithmetic probe only.

This batch adds provisional **AFULL-SQL-03**, and extends existing **AFULL-SQL-01/02** to additional objects. Migration141 supersedes135: the playoff scope defect is corrected in the terminal source and is **not reopened**. Source headers saying NOT APPLIED or recording production counts remain historical comments; source hash equality cannot establish hosted state.

## Findings and extensions

### AFULL-SQL-03 — P2 provisional: missing league hits/blocks become zero with full exposure

**Source-confirmed scenario, SQL runtime not reproduced.** `20261112090000_guard_forge_league_skater_physical_totals_cutoff.sql:50` uses `coalesce(s.hits,0)` and `coalesce(s.blocked_shots,0)` for every qualifying player-game. Lines53–59 admit GP1/positive TOI/position rows by season/date without requiring either count. Lines62–63 count those games and sum all their TOI. The baseline table declares hits and blocked_shots nullable (`20260716112908_production_schema_baseline.sql:5811–5850`). No metric-specific known-game coverage is returned.

For one F/to_date bucket, two1200-second rows with hits2 and NULL become2hits/2400seconds, i.e.3hits/60. Complete-scope rate is unknown; the known game's covered rate is6/60. The same error applies independently to blocks and prior2 totals. All-null event counts produce a positive-exposure zero, not an unavailable measure.

**Expected:** rules5/13/16/24 require unknown or a disclosed matched covered sample. The added pre-September cutoff guard is correct but leaves this existing defect in the current function. **Reader reach:** `web/lib/projections/queries/skater-queries.ts:454–505` calls the RPC and accepts the manufactured finite nonnegative rows; it rejects actual nulls but cannot recover missingness after COALESCE. `stages/skater-stage.ts:1617–1632,2294–2300` passes league totals into `computeSkaterPhysicalEventRates`; `calculators/skater-adjustments.ts:495–502,505–540` computes prior per60, a shrunk current rate and bounded scale, then rescales player history. Bad totals can alter the actual physical-rate prior/scale; no hosted projection impact measured.

**Bounded fix:** preserve unknown per metric, or aggregate each count with its own matched TOI and coverage; align the reader contract so unavailable support selects its existing unscaled fallback. Do not turn incomplete rows into observed zero. Retain empty-bucket/invalid-scope compatibility separately from missing-input semantics. **Regression:** null hits with known blocks, null blocks with known hits, all-null count with positive TOI, mixed known/null in current and prior buckets; assert downstream unavailable/fallback or explicit paired coverage. Existing `l4a_physical_totals_cutoff.py:39–53,75–94` contains only known counts, so it does not pin this.

A suspected playoff issue was rejected: current WGO skater producer explicitly sends gameType2 to `wgo_skater_stats` and3 to `wgo_skater_stats_playoffs` (`update-wgo-skaters.ts:1660–1698`). No new playoff finding for137; actual legacy table contamination was not checked.

### AFULL-SQL-01 extension — unprotected season goalie totals and SV% in terminal141

Primary weekly finding remains in batch125–134. Additional source: `20261112130000_goalie_totals_unified_regular_season.sql:383–408,410–418,421–423,425,431,435` independently SUMs nullable official and NST counts, and emits official SV%/GAA/complete-game%/quality-start%/SA60 plus NST all/5v5/HD SV% without complete-input guards. `vw_goalie_stats_unified_source` passes official nullable values through (baseline9670–9706) and LEFT JOINs NST by player/date/season (9995–10006); source omissions survive as null inputs. Its GP1/date>=2023-01-01 filter is upstream of141.

Two regular appearances with official or NST `(saves,SA)=(27,30),(NULL,30)` produce.45 instead of unknown. Official GA3/NULL with TOI3600/3600 produces1.5GAA. For an entire missing NST row, NST raw sums/SV% can look complete despite GP including the appearance. Guards correctly blank **rewritten GSAA and NST per60/GAA**, but not every field, contrary to broad wording about "every NST value" in historical comments. `bool_or(has_nst_*)` means any source row exists, not complete coverage.

**Local severity for this extension:** P2 source risk, because bounded search of web/ and functions/ source found no current application reference to goalie_totals_unified or its snapshot beyond generated types. The dependent materialized snapshot remains a reader/storage path; external use is unknown. Do not transfer the weekly consumer reach automatically to this view. **Fix/test:** metric-specific complete support and consistent coverage policy across all exposed totals/ratios; extend goalie proof to partial nullable official/NST inputs and assert raw totals/SV%, not just its12 rewritten values. Existing `l4a_goalie_totals.py:120–175` intentionally tests only rewritten fields for the missing-NST goalie and treats some original sums as unchanged controls. Terminal141 does fix135's playoff scope; no regression of that closure is alleged.

### AFULL-SQL-02 extension — 5v5 IPP repeats unmatched aggregate join

`20261111181100_add_nst_seasonlong_5v5_views.sql:143–145` adds the same `100*individual.total_points/on_ice.gf` join on player+season as126. Individual counts (30–67) and on-ice counts (69–108) independently retain rows; a missing counterpart date is invisible to COUNT(field)=COUNT(*). Two individual dates with points1+1 and GF2 only on the first yield100%; paired observed IPP50%, full scope unknown. Equal GP is insufficient for disjoint date sets.

**Fix/test:** same support-set rule and missing/opposite/equal-size-disjoint-date fixtures as original SQL-02. `l4a_nst_5v5_views.py:110–117` does test IPP arithmetic, but its player1 individual/on-ice dates are aligned, so it misses this defect. Current radar reads these views (`radarSeasonStats.ts:40–61`) but has no IPP stat reference (targeted search); do not claim radar displays bad IPP. SQL/API view is exposed with SELECT to anon/authenticated/service_role. No other current direct IPP consumer of136 was established.

## Object, unit, null, version and grant review

**135 and terminal141: goalie_totals_unified.** `game_data` carries official source fields and all NST strength fields, computes valid SA/GA or HD SA/saves flags (both present; GA≤SA or saves≤SA), and141 adds regular-season date+season EXISTS. League_daily pools matching valid pairs per season/date for all/5v5 and their HD subsets. League_window pools those daily values over each goalie's first-to-last source appearance, inclusive; zero total SA -> null. Final aggregate groups player+season and window rates. GSAA=SUM(SA)×league goals/shot−SUM(GA), HD GA=SA−saves; all required goalie rows must have valid inputs. GSAA60, GAA, saves60, SA60, xGA60 explicitly convert NST decimal **minutes×60** before per-hour division. Official TOI is seconds; official GAA/SA60 multiply3600. NST output `*_toi` stays minutes; SV ratios are fractions. No new rounding or cap. No nonnegative/finite validation beyond the listed flags; no separate real invalid-input incident established.

Official GP/GS/W/L/OTL/SV/GA/SA/TOI/SO/G/A/complete/incomplete/QS/regulation results are sums. NST all/5v5 TOI/SA/SV/GA/xGA/HD counts and all rush/rebound totals are sums. Name/position/catches use MAX; teams use distinct array (not ordered, sourced from players current team upstream, not claimed team-of-record reconstruction). Ten has-source flags use bool_or; `materialized_at` is query timestamp, not last ingestion time. These source provenance limitations are documented, not independently promoted to fresh findings without consumer demand. Output shape unchanged; CREATE OR REPLACE keeps ACLs/dependents.135 is a single statement;141 wraps transaction/5s lock/60s statement bounds. Neither refreshes snapshot. Retained old snapshot contents remain outside source acceptance.

**136: three new 5v5 views.** Individual counts includes GP/TOI/G/A1/A2/A/points/SOG/ixG/iCF/iFF/iSCF/iHDCF/rush/rebounds/PIM/penalty classes/drawn/giveaways/takeaways/hits/hits-taken/blocks/faceoffs; each sum null if any retained row lacks its field. SH%=G/SOG×100; FO%=FOW/(FOW+FOL)×100. On-ice counts includes TOI and all for/against attempt/shot/goal/xG/chance/danger/zone counts with corresponding completeness guards and baseline casts. GP1/type2 date membership, player+season grouping. Rates divide individual counts×3600/TOI; inherited SH/FO; IPP exception above. No on-ice rates view added. Owner-run views match sibling posture; explicit SELECT grants to anon/authenticated/service_role (no write grants). Transaction5s/60s. CREATE VIEW is intentionally single-apply, not idempotent reapply. Rollback drops rates then two count views without CASCADE, preserving preexisting ES objects; current radar dependency must be coordinated before a real rollback.

**137: physical totals function.** STABLE SQL SECURITY INVOKER, empty search_path; season integer must be valid consecutive years in bounds; cutoff≥Sept1 start. GP1/positive TOI/F-or-D; current rows date≥Sept1 and<min(cutoff,nextSept1), prior2 season IDs−10001/−20002 with date range and shifted-year consistency. Four fixed scope×position rows, zero output for empty/invalid scope, ordered scope/position. TOI seconds; hit/block count sums and player-game count. Revoke PUBLIC/anon/authenticated EXECUTE; service_role only (owner implicit). No row writes. Current function equals rollback body plus exactly one cutoff line; literal body MD5s verified offline below. Residual SQL-03 remains.

**138: forecast_basis and forecast universe.** Nullable text basis with CHECK unconditional/conditional_dressed; existing rows untouched. Universe PK(served_date,player_id,game_id), non-null season/player/game/class/team identity, class CHECK skater/goalie, nullable dressed/receipt/settled_at, timestamps default now, before-update timestamp trigger. No FK added, no enforced receipt schema or membership immutability (route owns those contracts; not a full route audit). RLS enabled, no policies; revoke all from PUBLIC/anon/authenticated/service_role then service_role SELECT/INSERT/UPDATE only. No DELETE/TRUNCATE. Service role bypass-RLS deployment posture is assumed by existing project contract, not live-verified. Existing ledger ACL and scoreboard fixed column list unchanged. Adds no rows. Current flag is true; readers derive legacy null basis by source/class (`servedForecastLedger.ts:18–75`), snapshot upserts independent universe, settle updates receipt and dressed, scoreboard reads it. These excerpts establish use, not complete correctness of those routes.

**139: expected_games nullable.** Exactly two NOT NULL drops on aggregate/release tables; type/default/CHECKs/immutability/RLS/grants unchanged. Expected-games [0,84] non-NaN CHECK still permits null. Existing starts≤games CHECK becomes unknown when games null, so nonnegative starts need not be bounded by games; explicitly acknowledged source caveat. No numeric computation or historical row update. Header says writer sends both null together; inspected current `seasonJobs.ts:410–430` independently reads GAMES_PLAYED and GAMES_STARTED, so that assertion is not established for arbitrary input. No confirmed invalid stored row or reachable publication defect declared; gate any future stronger invariant on actual writer-input contract. Rollback refuses permanently once immutable null rows exist; not an authorization to remove history.

**140: predictions_sko_vdp compatibility view.** Copies13 table columns verbatim and appends stability_sd and vdp. SD alias only for baseline-moving-average v0.2/v0.3/v0.4 and finite non-null stability_cv; unknown version/model/nonfinite/null ->null. VDP aliases sko for all rows without revalidation. SECURITY INVOKER preserves table RLS/permissions; SELECT grants to anon/authenticated/service_role. No stored-row rewrite, rename, backfill or history change. Current compatibility API `stabilitySdOf` matches version/finite rule; no current view consumer found in bounded app search. D134/definition reviewed: unvalidated points pace×horizon×volatility multiplier, appearance horizon, v0.4 current-season scope; this view does not claim qualification or recompute the model. Header readback expectation sd_differs0 needs finite known-version rows; its unqualified wording does not hold for deliberately nonfinite historic values, while SQL itself handles them correctly.

## Proof source review and rollback credibility

Every proof uses isolated tempfile PG15 data/socket, explicit Unix-socket connection, pg_ctl `-h ''` and own data-dir teardown. No proof was imported/executed; AST parse only. All runtime observations below are **assertions the source intends**, not results this turn. Bootstrap failure established previously applies; no alternate DB attempted.

|Proof|Fail-first/control strength|Uncovered boundaries / rollback|
|---|---|---|
|l4a_goalie_totals.py|Real unified source view, synthetic6 goalies;13 original defect checks,7 terminal141 scope checks,3 controls. Baseline→135→141 twice, type shape, unchanged regular-only goalie answers, local snapshot refresh,141 rollback exact135 answers then135 baseline answers.|Missing NST assertion covers12 rewritten fields only; no partial-null SV/raw count cases. Snapshot check row count, not every cell. Selected schema omits full actual constraints/grants.135 rollback restores bad minutes factor/per-game GSAA;141 rollback preserves135 correction but reinstates playoff scope.|
|l4a_nst_5v5_views.py|5 absence-before/present-after checks including correct IPP for aligned support; ES unchanged; view shape equal sibling; SELECT privilege checks; drop rollback.|Missing-view baseline only proves feature addition, not adversarial old arithmetic. No counterpart-date loss case, no full role query execution (privilege catalog check).|
|l4a_physical_totals_cutoff.py|3 prior-window failures,5 controls; invalid/tiny season, Sept1/current cutoffs; exact one-line body delta, MD5, volatility/security/search_path/grants; rollback body/grants.|No null hit/block input, so SQL-03 invisible. Invalid scope zero rows is explicit historical contract, not proof missing data should become zero.|
|l4a_ledger_basis_universe.py|6 new schema assertions: valid bases/bad basis; universe upsert/key, timestamp, class/season checks, RLS/policies/ACL role privilege equality.5 controls: stored row, legacy-null basis, source check, scoreboard answers, ledger ACL. Rollback shape/constraints.|Owner-role writes and privilege introspection; no actual service-role/RLS bypass query or app identity/finality settlement test. Destructive rollback drops universe data and basis; turn flag off/release and separately authorize data loss before use. No data-loss execution here.|
|l4a_expected_games_nullable.py|Null accepted only after; known rows/85/NaN/starts>known-games controls; exact other-column/constraints/triggers/RLS/ACL invariant. Rollback rejects stored null23502 and immutable DELETE55000; second clean DB restores exact baseline.|Fixture strips FKs and recreates immutability function; no actual publish/clone execution. Does not test starts bounded when games null. Rollback has explicit precheck then SET NOT NULL in one transaction; NULL rows cannot be erased under existing contract.|
|l4a_predictions_sko_vdp.py|8-row model/version/NaN/Infinity/null fixture; exact alias, anon RLS read, outsider with view-only SELECT denied, grants; table row digest/columns/constraints/policies/ACL/relfilenode unchanged; ordered appended columns; drop rollback.|Negative Infinity not fixture-covered though handled in SQL. "Byte-identical" assertion actually hashes textual row serialization; sufficient logical unchanged fixture evidence, not physical byte proof. Existing dependencies would make DROP fail safely without CASCADE.|

## Offline verification actually run

Authored/safety-inspected `/private/tmp/astra-sql135-static.py`: standard-library Path/AST/regex/hash/math only; reads assigned files, imports no app/proof modules, no subprocess/DB/network. `/usr/local/bin/python3 -I /private/tmp/astra-sql135-static.py` exited0:

- Six proof Python ASTs parse; no proof body run.
-141 rollback normalized CREATE VIEW equals135 exactly.
-137 body differs from rollback by exactly the new cutoff line. MD5 fixed `0eec9782543c02db802b021c950ecf6e`; rollback `4d70925bd2a309b78daf0d3e0bf6b01c`, matching documented values.
- Arithmetic counterexamples: nullable SUM SV=.45/GAA1.5; unmatched IPP100 versus paired50; null-as-zero hits3/60 versus known-game6/60. This checks arithmetic, not PostgreSQL execution.

No missing assigned source. Remaining gaps: actual migration/rollback/grants execution, current hosted definitions/data/consumers, live coverage, snapshot freshness and production approvals. Context-only excerpts remain pending for any full application audit. No permission or deployment implied by source approval comments. Earlier governing rules/AGENTS/mise were already fully read; this batch additionally read complete relevant D41/D78 entries, D134 and VDP definition, and reused D10/D15/D69/rules5/13/16/17/21/24.

## Chef IPP consumer correction

Chef independently confirmed that the older126 IPP select lives in `fetchPercentilePlayerData` (`fetchWigoPlayerStats.ts:991`), with no caller found in bounded web TS/TSX search; matrix IPP uses another aggregation path. See appended correction in `batch-sql-125-134.md`. Neither original SQL-02 nor this136 extension establishes a live WiGO/radar display defect. Direct SQL view algebra remains affected; P2 source finding retained.

## Full-read manifest: assigned20 files

|Path|Bytes|Read range|SHA-256|Target match|
|---|---:|---|---|---|
|`supabase/migrations/20261111181000_fix_goalie_totals_nst_units_aggregate_gsaa.sql`|35072|1–442 full|`61f922ae3e07246514f3e94053a71cdf806b8bdb33113f6ed313f83c4835b909`|yes|
|`supabase/migrations/20261111181100_add_nst_seasonlong_5v5_views.sql`|16559|1–151 full|`f741beed8fb32c065353700d3022e9c8a6dec6157db234ae6fa786200ba40e1a`|yes|
|`supabase/migrations/20261112090000_guard_forge_league_skater_physical_totals_cutoff.sql`|4134|1–73 full|`629904b3e5580f3732e9a45dee74b6450a1afb6ecda63ff1a46b433aa8778573`|yes|
|`supabase/migrations/20261112100000_add_forge_ledger_forecast_basis_and_universe.sql`|5120|1–72 full|`13858e5380efe8644e3448efcb796630f830471a1ec152d5e6aca5a42322859d`|yes|
|`supabase/migrations/20261112110000_player_forecast_season_expected_games_nullable.sql`|2782|1–37 full|`873f94ac574c2406cb025a94d706711cd3f606a4b8ddad626bd98f452b571472`|yes|
|`supabase/migrations/20261112120000_add_predictions_sko_vdp_view.sql`|3604|1–63 full|`5d2b71499a00429594804455d6a7bb72d43758675a2cb5da7c8ad723a3b13dc6`|yes|
|`supabase/migrations/20261112130000_goalie_totals_unified_regular_season.sql`|35349|1–451 full|`733f9077d2f67991862f6e8c5a4bb83374f877c5be5dd745d5914a4c88c458c8`|yes|
|`supabase/tests/l4a_goalie_totals.py`|15345|1–256 full|`20a1c52e4fea25b38f308d4094f01982a01e8318ab53c09e5951b9dd02e17f01`|yes|
|`supabase/tests/l4a_goalie_totals_rollback.sql`|26325|1–379 full|`6ddfff857aff2af1e594779e771aca78baf6f88d3ebd4189d67f6f2c6821ef29`|yes|
|`supabase/tests/l4a_nst_5v5_views.py`|10794|1–192 full|`15d59c1e568bc3ff40d3d3e53d7cc059b29c8b3caea4177991368782515241de`|yes|
|`supabase/tests/l4a_nst_5v5_views_rollback.sql`|367|1–7 full|`25a1c7c7b541b50e6a816205393f6f7132b30c3f44335601ca2ee7aa98f4aa27`|yes|
|`supabase/tests/l4a_physical_totals_cutoff.py`|9408|1–163 full|`871c9ec7cec4bc283934b7807c334795c7c1096ff50fcb8c5223493b47a43190`|yes|
|`supabase/tests/l4a_physical_totals_cutoff_rollback.sql`|2207|1–51 full|`7bdc3ae70b5748bff5af824e32de18770dbebbde14e05ce1ee20a6800b568890`|yes|
|`supabase/tests/l4a_ledger_basis_universe.py`|10442|1–185 full|`ebc171336ae00615a5ede26d0ee5a4ed409425f7105af16cb281f2a2e4377743`|yes|
|`supabase/tests/l4a_ledger_basis_universe_rollback.sql`|527|1–9 full|`60206948fd3185260a1944a7f417a1e0314268160859b6c4fb0bb87a56ec62a9`|yes|
|`supabase/tests/l4a_expected_games_nullable.py`|10089|1–194 full|`25242a99d8288e253bc7bfa62c17e1f0442e2fe475756821e78539cfd4965377`|yes|
|`supabase/tests/l4a_expected_games_nullable_rollback.sql`|1004|1–21 full|`8193c62a7d36ed73d6af2b3566b6ca87244fc0db24ef73927153c2cb056984d5`|yes|
|`supabase/tests/l4a_predictions_sko_vdp.py`|9380|1–176 full|`9f6c445cd089a25511794c51364ec965c8f7a79f304e1370655a3bfe8a010b4a`|yes|
|`supabase/tests/l4a_predictions_sko_vdp_rollback.sql`|368|1–8 full|`a287d3da21bac813220671d6f4fd2c20d7db0900aad8960e748abfb4143f7abd`|yes|
|`supabase/tests/l4a_goalie_totals_regular_season_rollback.sql`|32628|1–419 full|`72a5cca58a4dba151d2626fda7ce75d504940b67c2ef008e6a1cf35796d80c54`|yes|

## Context-only reading manifest

These15 paths are excluded from full-audit integration. Searches establish navigation/absence within named source scope only; no external consumer claim.

|Path|Bytes|Read range|SHA-256|
|---|---:|---|---|
|`tasks/artifacts/calculation-inventory-2026-11-10/master/OWNER-DECISIONS.md`|67656|132–143;280–292;354–360; earlier D10/15/69 reused|`f27b30d4b74355f7f957171444783c16096c1d68030296358fe406657d838497`|
|`tasks/artifacts/legacy-sko-definition-2026-11-12/DEFINITION.md`|2536|full|`b353317a3661f8436a948cb56c1bf5343353c1c22b0e3c1b872e5f685d1e73eb`|
|`supabase/migrations/20260716112908_production_schema_baseline.sql`|1787923|5811–5850;9670–9706;9990–10010; earlier nullable WGO-goalie columns reused|`27067d2221516be147d5cf71492b1fee3f0fd377d0ccd14e49557931ad1b791d`|
|`web/lib/projections/queries/skater-queries.ts`|32634|395–520|`d72921c7c0f68bf14c43e3f9c9ea6ca73e63e6f62b758fd0d0b7be56ddda6f7f`|
|`web/lib/projections/stages/skater-stage.ts`|159266|1615–1638;2283–2308|`9a389ff937d5aff5377271fd09e6e0e7659be6734e4f943eb8ebcf9ba628707a`|
|`web/lib/projections/calculators/skater-adjustments.ts`|42269|375–565|`ae120b556adba8d689c54b572346e7c09134e3fad1178fb1f2404d06080dea60`|
|`web/pages/api/v1/db/update-wgo-skaters.ts`|84175|1660–1698; gameType keyword hits|`2f4ec05a07407d8e22d1e5448ecdcb7901c78e3788f7683c4e22eb37499334ad`|
|`web/lib/player-forecasts/servedForecastLedger.ts`|59906|18–75; bounded flag/basis hits|`c98ad97650207595dfe998fd369d0863a8ea7114d102cf85115fd2a8dd8f669b`|
|`web/pages/api/v1/db/forge-served-forecast-snapshot.ts`|15106|105–125|`54e077dbbcc062971963ebf2694bc90cccd3150338962afde3928048cf187153`|
|`web/pages/api/v1/db/forge-served-forecast-settle.ts`|9893|75–97|`1ab5e021d21fcbc4de469b21f9a968bfcc510dcd904a94ef705dbc4168d5a134`|
|`web/pages/api/v1/forge/scoreboard.ts`|6806|40–70|`6e34a809db235eb30f0cce6cd59da1e46a24b8fd4dd3fa6772119a507b054746`|
|`web/lib/fantasy-projections/seasonJobs.ts`|51359|410–430|`7ae6fa74480caca9e68d70e572871a90479db663e173c1a9e097a43413573ffb`|
|`web/lib/predictions/legacyQuarantine.ts`|8577|40–61|`46a69e81596331389da09bfa3e52f59cab451cc64c4caca23aecd379bf9e6b4f`|
|`web/pages/api/v1/ml/get-predictions-sko.ts`|10810|98–112|`7d69b417d90deca63e48f2a02724754481b67158f3a4332a84923ebce40a9ccb`|
|`web/lib/nst/radarSeasonStats.ts`|9318|35–61; IPP search no hits|`74fc49d69a0b807475d720ccb3c176c67c9e17953449fb61b35028f8eaebb24e`|

TSV has97 rows plus header: assigned SQL objects, schema/grant controls, CTEs, proof functions and15 explicitly context-only rows. Every assigned file represented; full-file source audit does not assert SQL runtime passed.

## Chef severity override (2026-11-14)

Chef independently reviewed137 SQL, fetchLeaguePhysicalTotals and leagueReference, and accepted **AFULL-SQL-03 as P1** because manufactured finite RPC rows enter the current physical-rate calculation. This supersedes the worker's provisional P2. It is not P0 and does not establish live prevalence or measured production impact.
