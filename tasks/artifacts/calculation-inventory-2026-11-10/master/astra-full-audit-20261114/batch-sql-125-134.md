# SQL source audit: authority 125–134

2026-11-14 · worker `gpt-6-astra/high` (actual rollout verified) · Chef owns acceptance and canonical ledger. Target `89da739cb45d7d572ed59bfa0b209c79c5d99299`. This batch fully read ten migrations in path order, then their five Python proofs and five rollback SQL files. No application, SQL or test source was changed. Two provisional source findings remain. SQL execution is **blocked**, not passed. No hosted definition, data prevalence, migration application or approval was verified.

Scope authority: `source-integrity.json` supplies the 29-file manifest and parent-confirmed authority hashes; 125–134 are the first ten. Full audit prompt, AGENTS and mise-en-place were read during the preceding read-first assignment. Rules digest was read in full (1–117); wave 2 rules 13–21 (32–46), wave 3 rules 22–26 (32–43), and complete relevant owner decision entries in OWNER-DECISIONS (24–33, 69–76, 242–260, 302–322, 361–366) govern this batch: unknown stays unknown; paired numerators/exposure; regular-season scope; covered subset must disclose coverage; pooled rates; house all-situation Game Score; assignments versus dressed PP share; D138 supersedes interim trade unknown. Prior reports are retained claims, not substitutes for this read.

## Findings for Chef review

### AFULL-SQL-01 — P1: weekly goalie sums still turn partially missing inputs into plausible rates

**Status:** source-confirmed counterexample; runtime reproduction blocked; production prevalence unknown. Migration `20261111180600_fix_goalie_weekly_zero_denominators.sql:20–43` independently SUMs nullable fields and divides them. Its league view repeats the problem at 54–81. Fixing only zero denominators does not preserve missingness when another row contributes a non-null value. Baseline `20260716112908_production_schema_baseline.sql:9617–9657` declares saves, SA, GA, starts, wins, shutouts and TOI nullable. `wigo_goalies:11525–11603` passes those values through. A targeted migration search found no later replacement of wigo_goalies or these weekly views.

**Concrete scenario:** same goalie, two positive-TOI games in a Yahoo week: game A `(SV,SA,GA,TOI)=(27,30,3,3600)`; game B `(NULL,30,NULL,3600)`. Both pass `TOI>0`. Weekly sums become SV=27, SA=60, GA=3, TOI=7200, so served SV%=0.45 and GAA=1.5. Neither is a complete-week rate; the missing second game's saves/GA were silently omitted while its exposure remained. Even making the weekly row null would require a corresponding league guard; otherwise SUM of one null goalie alongside known goalies still silently omits that numerator.

**Expected:** under rules 5/15/16/24, unknown full-window count/rate or explicitly matched covered subset with coverage. The source has no coverage column. Related scope risk: wigo_goalies inner-joins two NST tables, so a WGO appearance missing either NST row disappears altogether before weekly totals (11599–11603). That omission is visible in source but this batch did not prove its live incidence or separately classify every upstream join invariant.

**Reader reach:** current source `web/pages/trueGoalieValue.tsx:351–365` fetches both views; 548–577 passes them to `calculateGoalieRankings`. `web/lib/socialShare/modules/goaliePeriod.sources.ts:26–34` reads the same views for TGV. Readers cannot recover missing game support from a plausible non-null aggregate. This is a read-path finding; no page request was made.

**Suggested bounded fix:** guard each weekly count against incomplete expected game support, pair the inputs used for each ratio, and either propagate incomplete coverage through league totals/means or publish explicitly named covered measures with counts. Preserve the approved starter/cohort definition; do not silently use zero. Evaluate WGO-to-NST row loss as part of defining the expected appearance set.

**Regression needed:** at least one known and one missing component with positive denominators; unequal saves/SA/GA support; an entirely unknown goalie alongside a known goalie; missing NST join row. Existing `l4a_sql_readers.py:103–146` checks zero-SA unknown only and replaces wigo_goalies with a stand-in table. It cannot pin these cases. No new test was written.

### AFULL-SQL-02 — P2: season IPP divides independently covered game sets

**Status:** source-confirmed counterexample; runtime reproduction blocked; no live prevalence claim. Migration `20261111180100_fix_nst_seasonlong_rates_unknown_and_ozs.sql:48–50,133–135,218–220,303–305` computes `100*individual.total_points/on_ice.gf` after joining only player+season. The two aggregates independently select their gamelog rows in migration 125 (e.g. 22–59 versus 61–100). Complete-field COUNT guards detect a null on an existing row, not a missing row from the other table. Source uniqueness permits distinct subsets: baseline ES tables have per-table player/date uniqueness (31731–31775) and player FKs (38831–38843), not a paired-date constraint.

**Concrete scenario:** two regular-season dates, individual points 1 and 1, on-ice GF=2 only for the first date. The individual aggregate has 2 points; on-ice has 2 GF; IPP returns 100%. The only paired observed game's IPP is 50%, and a full-season IPP is unknown because the second denominator is missing. Equal GP alone is insufficient: two sets may have equal sizes and different dates. The pattern applies to ES/PP/PK/AS.

**Expected:** same player, strength, season and game/date cohort for numerator and denominator; unknown when full scope is incomplete or explicitly disclose a covered-game subset. **Suggested fix:** join per-game inputs before aggregation or compare actual support sets before emitting IPP. Keep metric-specific null guards and no invented zero/default. Do not fix by capping percentages.

**Reader reach:** baseline `nst_percentile_es_offense:18957–19002` forwards `r.ipp`. Current `web/utils/fetchWigoPlayerStats.ts:997–1040,1079–1103` explicitly selects IPP from AS/ES/PP offense views. The separately inspected `fetchWigoPercentiles.ts:19–25,179–205` does **not** select IPP, so this report does not attribute the defect to that panel or assert final rendered/ranking impact. Direct SQL views remain affected. RosterMatrix's rates query selects points/60 and ixG/60, not IPP (230–244).

**Regression needed:** delete one on-ice gamelog row while retaining the individual row; repeat opposite direction and equal-size/disjoint-date sets. `nst_seasonlong_l4a.py:102–135` tests scope, a null field, zero denominators and OZ definitions but not missing counterpart rows or IPP support. Existing dependent-view query checks readability, not correct IPP.

## Reviewed definitions and dispositions

| Authority / source suffix | Computation, scope, null and identity behavior | Verdict |
|---|---|---|
|125 counts regular season|Eight views: ES/PP/PK/AS × individual/on-ice; group player+season; only GP=1 rows with a game on the same date/season and type2. Each numeric sum is null unless all retained rows have that field. Shooting%=G/SOG; faceoff%=FOW/(FOW+FOL); null/zero support yields null. Retains bigint/double casts and output order.|Intended correction present. Date-only regular-season membership assumes regular/playoff dates do not overlap (documented source assumption), not an exact player-game identity proof. Missing whole rows remain undetectable; IPP consequence in SQL-02.|
|126 rates unknown/OZS|Eight rates views: individual and on-ice count×3600/TOI; for/(for+against)×100 shares; xG same; on-ice SH%=GF/SF; SV%=(SA−GA)/SA; PDO=sum of these percentages; OZS and OZFO exclude neutral zone (OZ/(OZ+DZ)); IPP=points/GF×100. NULLIF zero denominator, no manufactured 0/50/100 or cap. Negative/invalid upstream values are not validated here.|Intended algebra present except cross-table support finding SQL-02.|
|127 Game Score|RPC player+season AND regular game (game_id match when present, date fallback otherwise), removes rows with unknown score, orders date ascending. House formula .75G+.70A1+.55A2+.075SOG+.05BLK+.15PD−.15PEN+.01FOW−.01FOL+.05SATfor−.05SATagainst+.15(all-situation GF)−.15(all-situation GA). All operands required by NULL propagation. SECURITY DEFINER preserved; fixed search_path.|D85 all-situation house formula and D69 scope reflected. Exact game/date consistency for malformed WGO source is upstream; no demonstrated defect here.|
|128 skater averages|Inclusive date range via games join, type2; AVG G/A/plusminus/PIM/hits/blocks/PPP/shots and COUNT(playerId) games. Invoker security; fixed search_path.|Regular-season correction present. No claim that COUNT games proves per-field coverage for arbitrary nullable inputs; no additional proven defect in this batch.|
|129 team data|Latest global standings date, NST LEFT JOIN exact team_abbrev+season; absent matching NST stays null. GF/GA per GP use standings; NST xGF/xGA/SF/SA per GP use NST positive GP. Appends NST season/asof provenance; standings columns retain original shape.|Season-leakage correction present. Later reader historical guards are separate audit scope. Uniqueness and live source freshness not verified here.|
|130 gameOutcomes|Self-join teamGameStats on game and different team; higher score WIN, lower LOSS, equal/missing NULL. Team final result, not individual goalie decision. No own final-state filter; writer finality is prerequisite.|Level-score unknown correction present. No attribution of team result to goalie; multiple corrupt team rows not manufactured for finding.|
|131 goalie weekly|Yahoo week/date/season join; TOI>0; sums all stats; latest date name/team; pooled SV/GAA/SV60/SA60. League sums and per-goalie means. Zero denominators null.|Residual SQL-01; intended zero fix present. Equal-date name ordering not separately deterministic; no real tie scenario established.|
|132 deployment|Refresh deletes only requested season/player scope and inserts aggregates. Forwards first12, triples into lines, rank declared position L/C/R then ordinal and assign deterministic three slots. Defense first6, pairs and alternating LD/RD. PP DISTINCT ON player/season/type/game chooses lower unit (PP1) if both. Type2/3 separated. Counts distinct games, sorted distinct teams, first/last dates. Assigned share=unit games/sum assigned; dressed share=own assignment on covered dressed games/covered dressed games; coverage=covered dressed/all dressed. All ratios rounded4; positive-denominator guard.|D86 separate measures present. Coverage uses any valid PP assignment for a dressed teammate as evidence team PP recorded, not proof of a complete team PP payload. No zero row generated for a player never recorded on PP. Reader must preserve coverage interpretation. No independently proven new defect.|
|133 interim percent_games|Skater detects WGO season team different from current; goalie detects comma-separated teams; traded value NULL, otherwise GP/current team GP. Other per-game totals use NULLIF(GP,0), rates passthrough. Header acknowledges absence of WGO rows can retain old denominator.|**Superseded** by authority143/D138 team-of-record denominator. Do not reopen interim limitation as current defect. Its proof/rollback addresses only this historical stage.|
|134 nullable skater fields|Drops NOT NULL on faceoffs/PPTOI/SHTOI, keeps defaults/history. Atomic writer validates arrays, 2 teams, bounded1..100 skaters/goalies and total≤100, IDs/count/distinct/positions, no overlap; all other payload values required. Game advisory lock, existence, preexisting bounds, upserts/prunes, observed count equality, complete=true contract1 status with timestamp. Invoker/search_path empty, grants preserved.|Intended three-field null support present. Function subsequently replaced by147 for additional goalie/team unknowns; evaluate terminal function in other batch. No claim of concurrency proof from this batch.|

Migration transaction wrappers preserve atomicity; lock timeouts are 5s, statement timeout 30s or60s as source specifies. No script executed against hosted data. CREATE OR REPLACE preserves existing object grants/dependencies except noted rollback drop/recreate. No unseen deployment grant state inferred.

## Proof credibility and rollback

All five Python files were fully read, including bootstrap and teardown. They extract selected baseline definitions from checked-in schema, then run baseline-fails → migration-passes → reapply → rollback. This is meaningful fail-first structure for listed assertions; selected schema fixtures do not prove all actual dependency, constraint, RLS/grant, concurrency or reader behavior.

- **NST**: 24 checks (6×4 strengths), counts/TOI/scope, null ixG, zero rates/shares, OZ2/(2+1); schema column/order/type equality; dependent percentiles can SELECT; reapply; rollback returns baseline booleans. Rollback fully restores16 original views, including known bad coalesce defaults and neutral-zone denominator. No IPP support assertion. Readability query is not percentile correctness.
- **SQL readers**: nine assertions across five migrations in both forward/reversed NST insertion orders; scope, exact-season join/absent season/asof/zeroGP, outcomes and zeroSA; function signature/security/search_path preserved; reapply; rollback. Stand-in wigo_goalies misses nullable/live join interactions. Rollback drops/recreates nhl_team_data to remove appended columns; broad baseline grants are restored, not arbitrary current ACLs. Existing external dependents can block DROP safely; no CASCADE. Must reconcile current schema/ACL before real rollback.
- **Lineup**: 20 games, adversarial forward positions; PP3/3 assigned versus3/16 covered dressed and16/20 coverage. Player-filter refresh exercises whole-line slot context. An unrelated-player SELECT is executed but its result is never asserted. Rollback restores old function and slot defects; added nullable columns remain. Rollback comparison checks slot results, not full old PP field state.
- **Percent games**: traded skater/goalie unknown and nontraded controls .75/.5, columns unchanged, reapply and rollback. Does not certify successor143. Restoring this rollback after143 would revert a different accepted contract.
- **Nullable game stats**: real RPC rejects optional-three nulls before and accepts after; other required skater/team inputs still reject; stored nulls/controls, only three column nullability changes, function properties, reapply. Rollback intentionally fails while null rows exist, then works after fixture null rows deleted; no historical production cleanup authorized. It restores old function plus NOT NULL, so after147 rollback ordering must respect the newer definition. No concurrency, all prune cases or live permissions test.

## Execution receipt and boundary

Chef approved five separate sequential commands, all Unix-socket-only disposable clusters. First:

`env -i PATH=/opt/homebrew/bin:/usr/bin:/bin HOME=/Users/tim TMPDIR=/private/tmp LC_ALL=C PYTHONDONTWRITEBYTECODE=1 python3 -I supabase/tests/nst_seasonlong_l4a.py`

Exit1 at import: `ModuleNotFoundError: No module named 'psycopg2'`; no cluster or connection. Existing `/usr/local/bin/python3 -I -c 'import sys, psycopg2; ...'` succeeded, version2.9.10. Chef approved changed interpreter:

`env -i PATH=/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin HOME=/Users/tim TMPDIR=/private/tmp LC_ALL=C PYTHONDONTWRITEBYTECODE=1 /usr/local/bin/python3 -I supabase/tests/nst_seasonlong_l4a.py > /private/tmp/astra-sql125-nst.log 2>&1`

Exit1 at initdb. Its captured stderr was hidden by script; retained temp directory contained only socket directory, no data/log. Chef approved one observability-changing diagnostic:

```sh
env -i PATH=/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin HOME=/Users/tim TMPDIR=/private/tmp LC_ALL=C PYTHONDONTWRITEBYTECODE=1 /usr/local/bin/python3 -I -c 'import runpy,subprocess,sys
try: runpy.run_path("supabase/tests/nst_seasonlong_l4a.py", run_name="__main__")
except subprocess.CalledProcessError as e:
 print("FAILED_COMMAND",e.cmd); print("STDOUT",e.stdout.decode() if e.stdout else ""); print("STDERR",e.stderr.decode() if e.stderr else ""); sys.exit(e.returncode)' > /private/tmp/astra-sql125-diagnostic.log 2>&1
```

Exit1: `FATAL: could not create shared memory segment: Operation not permitted`; failed `shmget(..., size=56, 03600)`. initdb states it removed `/private/tmp/nstseason-ev3dgm5n/data`. Neither attempt reached pg_ctl start, any SQL or a DB connection. Empty temp parent/socket directories retained; no server cleanup needed or claimed. No escalation, install, alternate DB or production fallback attempted.

**Other four proofs NOT RUN** because they share the blocked PG15 initdb bootstrap. Full SQL files were read, but all runtime migration/reapply/rollback assertions remain unexecuted this turn. Future approved local commands are the same sanitized explicit-interpreter prefix with, individually: `supabase/tests/l4a_sql_readers.py`, `l4a_lineup_deployment.py`, `l4a_percent_games.py`, `l4a_game_stats_nullable.py`; run only in an environment that permits the already-inspected disposable cluster. Do not interpret these commands as production authorization.

## Handoff gaps

No missing assigned source. Full source review is complete for20 assigned files; TSV marks it separately from blocked runtime. Auxiliary consumer/baseline excerpts are bounded context, not full-file audits. Two findings require Chef severity/ownership acceptance and focused regression. Do not merge any old historical finding merely because a rollback reproduces it. Production migration status, actual grants/schema, provider completeness and final rendered output remain unverified. SQL-02 reaches fetched raw IPP but this batch did not trace the last display/ranking consumer. Source-integrity cannot establish hosted definitions.

## Reading manifest

Full assigned file reads below. SHA-256 hashes are of actual checkout bytes read; `pin match` compares bytes with git target, not hosted state.

|Path|Bytes|Lines read|SHA-256|Pin match|
|---|---:|---|---|---|
|`supabase/migrations/20261111180000_fix_nst_seasonlong_counts_regular_season.sql`|42812|1–350 full|`7ce241a333d148d8300fc578196982987fb9d9895f7e550c06c67fe22b3ffe0c`|yes|
|`supabase/migrations/20261111180100_fix_nst_seasonlong_rates_unknown_and_ozs.sql`|35579|1–360 full|`1941a1a3fc29fdbf0a07449a0297f5ff36181e2fa098bb4ddf57c06c29cf3b63`|yes|
|`supabase/migrations/20261111180200_fix_game_score_season_scope.sql`|3342|1–73 full|`3db6cd19c293b7ef6b7b30ee3bbf8a67e65149a64f703c8a2aa95692bd305efb`|yes|
|`supabase/migrations/20261111180300_fix_skaters_avg_stats_regular_season.sql`|2148|1–44 full|`906afe80b1ecb3ecd84765ff26799abe570697bbd1c031b037ebb525b350d8f2`|yes|
|`supabase/migrations/20261111180400_fix_nhl_team_data_season_identity.sql`|7635|1–151 full|`3634494808fee15cd3af0f1ab5fb3ba94f6e92b51c4d90577316d9f315a2a1f1`|yes|
|`supabase/migrations/20261111180500_fix_game_outcomes_level_score_unknown.sql`|1747|1–33 full|`cb599ca7629ecc4198186fb6e7074137cd656b8aec4f575781f3116491380adc`|yes|
|`supabase/migrations/20261111180600_fix_goalie_weekly_zero_denominators.sql`|5407|1–92 full|`d28332d6df502cbbaf527caafe800e377d205fc755adcd899cbe3a8d70762bb5`|yes|
|`supabase/migrations/20261111180700_fix_lineup_deployment_slot_and_pp_share.sql`|14133|1–333 full|`867db3a96f05fe1e5b41ec18cac98cb7e5a9d53a8e100d825694d87585b2d78b`|yes|
|`supabase/migrations/20261111180800_fix_percent_games_multi_team_unknown.sql`|10508|1–150 full|`31c224d84dc17fbd171b20e2730759c83d2cb4efeeeacfec97411b834f9c0daa`|yes|
|`supabase/migrations/20261111180900_fix_skater_game_stats_placeholders_nullable.sql`|19043|1–488 full|`934be7806aecec9f956b229f15cd6364d382aa56b1e5db68c4584495a5b99d83`|yes|
|`supabase/tests/nst_seasonlong_l4a.py`|10968|1–199 full|`88f34f3753924938443d81eeea2cfb12f2b5041e5b652612cc023ef540aea6a5`|yes|
|`supabase/tests/nst_seasonlong_l4a_rollback.sql`|59275|1–644 full|`544ca9b6c166c35422dccc74c4ea44ff3a47bd57fa4b2dc28b5d904c99e72dfa`|yes|
|`supabase/tests/l4a_sql_readers.py`|13004|1–210 full|`9138d3a50621667a215a6dc6100b62f942333a03f0762db3d4ae65bce03fa909`|yes|
|`supabase/tests/l4a_sql_readers_rollback.sql`|14234|1–298 full|`7f3392c43971f3cfb29a5b11eb54ec963f1d48d5b605d6c8647344f03fdbafd0`|yes|
|`supabase/tests/l4a_lineup_deployment.py`|8163|1–150 full|`ead7f26e2a6394077f73b69d1d51e2bbb1227cbbf6e7de03a8fab4a9b7a56ed6`|yes|
|`supabase/tests/l4a_lineup_deployment_rollback.sql`|7545|1–213 full|`3a48592d468538be06e9c615047de563b8d08cfca1a89065d52bfef8208a2d6f`|yes|
|`supabase/tests/l4a_percent_games.py`|7192|1–136 full|`6d36e5553325dc897c8e0636cbbbf31707346da9c02a297f0c4a45153b96db89`|yes|
|`supabase/tests/l4a_percent_games_rollback.sql`|8476|1–118 full|`002cb282b02d504d3e281e4918e5eaa61bd0bae7a2d358db30fb2806a055059a`|yes|
|`supabase/tests/l4a_game_stats_nullable.py`|9394|1–177 full|`252944945184ca4c5ef2b15fbe17b6ccce4107011c4d44ea3dd83a697db7fc35`|yes|
|`supabase/tests/l4a_game_stats_nullable_rollback.sql`|17838|1–469 full|`fc38bfd33cc0befd059e5139958cc81c2233209fdd6b065d1bee01d4962d9818`|yes|

Auxiliary source reads: no full-file audit implied except explicitly marked. Search-only hits outside these excerpts supplied navigation, not defect proof.

|Path|Bytes|Ranges actually read|SHA-256|
|---|---:|---|---|
|`supabase/migrations/20260716112908_production_schema_baseline.sql`|1787923|9617–9675;11525–11665;16824–16915;16995–17073;18861–18888;18945–19005; constraint search hits31731–31775,32955,36808–36818,38831–38843|`27067d2221516be147d5cf71492b1fee3f0fd377d0ccd14e49557931ad1b791d`|
|`web/pages/trueGoalieValue.tsx`|33952|320–390;548–577; bounded symbol search hits|`c0f9e1bc4b9aa18530d4dcc1f545ff592dc44c6e6f306c51a671e3d7cac2c2da`|
|`web/lib/socialShare/modules/goaliePeriod.sources.ts`|6393|1–74 (full)|`b37c77bb60428452a514010f6b66ebe8de98e59cf035a72ee007ce9190642022`|
|`web/components/GoaliePage/goalieCalculations.ts`|28131|1–210; bounded symbol search hits|`42232f6e648c53540109e7f4c269f6e0e0467fce5d5cf22d7073494249c42fc5`|
|`web/utils/fetchWigoPercentiles.ts`|10313|1–100;175–225|`aa41324497caff51be950cda7088283c13c72c466ecb97957ffd1d13a7c93823`|
|`web/utils/fetchWigoPlayerStats.ts`|38389|993–1120|`7e9cf816cd40c2eae57fef244f2612e730074faf0fd48cf4bccecf0bbb526b05`|
|`web/utils/fetchWigoRatingStats.ts`|4217|1–100|`498dda11a1e5de82a03d66c8cde2bfdd96f9e013a73657ea2574d7be128eba7c`|
|`web/components/RosterMatrix/RosterMatrixWrapper.tsx`|12303|200–252|`21a8d9e68ceff77bcdf014c786aae3c859886697fcd257eb0de52924ddf37c70`|
|`tasks/artifacts/calculation-inventory-2026-11-10/master/RULES-DIGEST.md`|11650|1–117 (full)|`fd01301176e68fca8b61d4711c6ce117142bd42e74b3469d49a55697bdd75fad`|
|`tasks/artifacts/calculation-inventory-2026-11-10/master/WAVE2-CONSOLIDATED.md`|92997|32–46|`d08a9e4de86d177bce4e7744cc686fcbbbe067f5b00782fdbb0311e6e6a392f6`|
|`tasks/artifacts/calculation-inventory-2026-11-10/master/WAVE3-CONSOLIDATED.md`|86544|32–43|`115b6fc82717ad717fecba1f896ee5c1a3bca51bbc0e2b3c3352a8f51cbcb96f`|
|`tasks/artifacts/calculation-inventory-2026-11-10/master/OWNER-DECISIONS.md`|67656|24–33;69–76;242–260;302–322;361–366|`f27b30d4b74355f7f957171444783c16096c1d68030296358fe406657d838497`|
|`tasks/artifacts/calculation-inventory-2026-11-10/master/astra-full-audit-20261114/source-integrity.json`|12051|full|`480b9cdb7854837fe65f86ab654b1a3787844795a8644473b4a358c07083a7b6`|

TSV: 125 symbol/context rows plus header. Every assigned file has at least one row. Proof function symbols include nested boolean collectors. Prior read-first governing-source hashes remain in `readfirst-verdicts.md`; no memory-derived evidence used.

## Chef consumer correction (2026-11-14)

Chef independently traced the IPP select in `web/utils/fetchWigoPlayerStats.ts:991`: its function is **fetchPercentilePlayerData**, not fetchAllPlayerStatsForStrength. Chef's bounded `rg` across web TS/TSX found only that function's definition/log, no caller. WiGO matrix IPP comes through a different aggregation path. Therefore AFULL-SQL-02 must **not** be attributed to a live WiGO display from this evidence. Direct SQL views still return incorrect IPP under unequal cohorts; P2 remains appropriate. Earlier text describing fetched raw IPP establishes only a function body, not an invoked consumer. This correction is Chef-reported bounded source evidence; worker performed no further search.
