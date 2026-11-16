# Catalog batch2 — retained source comparison

Target `89da739cb45d7d572ed59bfa0b209c79c5d99299`. Local-only comparison by `readfirst_production`; Chef owns integration and adjudication.

## Result and boundary

Six exact function bodies and their complete returned contracts match the terminal pinned sources. All106 source-specified column checks,69 changed/new metadata entries and42 explicitly specified role-grant rows match. Four new tables were checked as full new-table contracts; existing tables were checked only for their named alterations. No source mismatch was established. Existing mathematical findings SQL-01/02/03/04 remain open as cross-referenced below; catalog agreement does not close them.

Five views have manually concordant deparse structure after every full diff was reviewed. Their §7 **applied matches source** cells remain **unverified** for exact compiled-tree/dependency/type-binding equality. Deparse output differs from CREATE VIEW text; no parentheses, casts, operators or predicates were discarded to manufacture a semantic match. This is a stated evidence limit, not an assertion that a view is wrong.

The retained execution record attributes direct approval to TJ and execution to Chef: seven sequential catalog SELECTs at20:26:43–20:28:21UTC on2026-11-14; rows1/24/6/507/350/81/6=975; initial hygiene0active/0seconds/0unknown; zero database errors, retries, application rows, RPC invocations or writes. This worker performed no remote action. The batch is exhausted.

`comparison.json` pins each receipt/source hash and records every catalog row with a zero-based JSON row pointer. Source authority hashes were rechecked. Snapshot evidence is point-in-time, not proof of ongoing state. The local `calculated_at` guard typo was corrected to source `computed_at` beforeQ5, without sending/retrying a query. Ordinary `unique=false` indexes are expected.

## Function contracts

| Function | Authority | Exact body SHA256 | Additional checked contract |
|---|---:|---|---|
| `public.forge_league_skater_physical_totals` | 137 | `f62d067a6acfdd9ddaf1a86fba5897c61e6712dbea2788dd9e7fd98caab62558` | Arguments and return names/types/order; no defaults; language; invoker; volatility; nonstrict; parallel unsafe; complete SET config; full-header absence of extra cost/rows/leakproof/support/transform settings; execute ACL |
| `fhfh_internal.reject_ctpi_v1_write` | 144 | `9db6e9ca29a46296ee104887f4cd6243b1e2d1ec7379bc8ef78b009e58a92bc3` | Arguments and return names/types/order; no defaults; language; invoker; volatility; nonstrict; parallel unsafe; complete SET config; full-header absence of extra cost/rows/leakproof/support/transform settings; execute ACL |
| `fhfh_internal.reject_sos_v1_write` | 145 | `8ed7881e21a4acaaac32e191d69253a007038d259b7965102df80b70b0c248f3` | Arguments and return names/types/order; no defaults; language; invoker; volatility; nonstrict; parallel unsafe; complete SET config; full-header absence of extra cost/rows/leakproof/support/transform settings; execute ACL |
| `public.persist_projection_game_derived_v1` | 148 | `62563de53d6a2741954f5fbcca277f8f16e910edd606185a8a00ec0215530482` | Arguments and return names/types/order; no defaults; language; invoker; volatility; nonstrict; parallel unsafe; complete SET config; full-header absence of extra cost/rows/leakproof/support/transform settings; execute ACL |
| `public.persist_projection_game_derived_v2` | 148 | `c2f7dee903a508096b0b04b820ea57a4f70f8261a58ee96319ab226517cf4fc3` | Arguments and return names/types/order; no defaults; language; invoker; volatility; nonstrict; parallel unsafe; complete SET config; full-header absence of extra cost/rows/leakproof/support/transform settings; execute ACL |
| `public.replace_power_play_game_v1` | 149 | `2ad9552a00f537e1b8fba191ea4ede8e941dcc8939420b455998f1a55a06e512` | Arguments and return names/types/order; no defaults; language; invoker; volatility; nonstrict; parallel unsafe; complete SET config; full-header absence of extra cost/rows/leakproof/support/transform settings; execute ACL |

All six body-byte comparisons pass, and each retained MD5 agrees with its raw `prosrc`. Authority137 supersedes88; authority148 v1 is the exact wrapper alongsidev2. All use empty search_path. v2 has5s lock/60s statement settings; PP replacement5s/30s; others only empty search_path. Freeze helpers are owner-only, the four other functions allow service_role and deny anon/authenticated. Default PostgreSQL function metadata is matched to the source where options are omitted. Ownership is retained context, not a CREATE declaration.

## Views — full preserved differences

No view is byte-equal or formatting-only-token-equal. The exact full diffs and both hashes are in JSON. Each unchanged span is preserved by the diff, and each changed span was inspected with its surrounding expression. This is manual structural review, not parser-based equivalence or function-result testing.

### public.goalie_totals_unified — authority141

Retained output has70columns; raw source query SHA `cb39c7c9a6bd2530f230fc45f28fb0d799c9dfbaec954523bec12fcd693f5675`, retained deparse SHA `30e395f66eb3e05458d88c8363a6918387db93d8612974f8b64e4d0477b13b6f`.

- No CTE, projection, aggregate, filter, join key or group key removed/reordered.
- Four availability conjunctions gain parentheses around individual predicates.
- Two sum(a-b) calls gain redundant parentheses, preserving subtraction inside SUM.
- Four league-window numeric casts collapse because sum(bigint) is already numeric; NULLIF zero is rendered as numeric.
- CASE/FILTER formatting and redundant parentheses differ; each all/v5 and HD completeness predicate and expression retains its grouping.
- FROM public qualifiers omitted in retained deparse; dependency OIDs and resolution search_path were not returned.

### public.nst_seasonlong_5v5_counts — authority136

Retained output has32columns; raw source query SHA `107f8946281de292cc3244b1cb4748043f1c6379f14dc35fc7465c721344202c`, retained deparse SHA `0df211feaeaed59977db3d919c1f35beabdfdb35547a817b72e96046ae8f58b7`.

- Every conditional COUNT=COUNT(*) guard remains paired to its own SUM/COALESCE field.
- Implicit ELSE NULL appears explicitly with resolved bigint/double precision type.
- Shooting and faceoff numerator/denominator CASE nesting, outer numeric casts, multiplier100 and NULLIF0 are preserved; redundant outer parentheses differ.
- gp=1, correlated regular-season EXISTS with season/date/type2 and player/season GROUP BY retained.
- FROM public qualifiers omitted; exact dependency OIDs were not returned.

### public.nst_seasonlong_5v5_counts_oi — authority136

Retained output has34columns; raw source query SHA `21c897d013ed8deedbd6c3d94ecd24f8d9dda395b31df6d38014f85de62e641b`, retained deparse SHA `49d0961029c05c826d1632733c293de548f561027d6bc70439171e3b77fee253`.

- Every conditional COUNT guard remains paired to its own on-ice aggregate; no unknown-to-zero change.
- Implicit ELSE NULL is explicit; gf/ga/scf/sca/hdca arguments gain double precision casts required by their explicit double-precision COALESCE fallback; outer bigint casts remain.
- gp=1, correlated season/date/type2 EXISTS and player/season grouping retained.
- FROM public qualifiers omitted; exact dependency OIDs were not returned.

### public.nst_seasonlong_5v5_rates — authority136

Retained output has33columns; raw source query SHA `295afba8be8fba4d297a4e1aeaad5ca0c1cb42184f1aa7760cab608f39e73e33`, retained deparse SHA `1a49517379f139383bba91fdd1de979304654b4ab7c0b6e8f984149d4912916b`.

- All per60 expressions and IPP retain multiplication-before-division, original numerator, NULLIF denominator,3600 or100 multiplier and final types; redundant wrapper parentheses removed.
- Counts LEFT JOIN on player_id AND season remains a LEFT JOIN with both predicates, not an INNER join.
- Public qualifiers omitted; exact dependency OIDs were not returned.

### public.predictions_sko_vdp — authority140

Retained output has15columns; raw source query SHA `8ae089683c0ea0f7ca3dbbe76eec203a5dd8954303e5c6fc276b1abde37072a2`, retained deparse SHA `ee47cc2a7a77a7503a5ea73a183a988dd744960c73b009a7346f34789e4276d9`.

- All15 output columns in original order; sko retained and aliased vdp.
- IN(version constants) becomes =ANY typed array with same three constants; NOT IN(nonfinite constants) becomes <>ALL with same three double literals.
- CASE adds implicit ELSE NULL::double precision; AND grouping and baseline-model restriction retained.
- security_invoker=true separately confirmed in q2.
- Public qualifier omitted; exact dependency OIDs were not returned.

No local PostgreSQL/parser/bootstrap or dependency installation was used. A stronger formal view equality result would need a separately approved local parser/compilation comparison against matching schema types, plus exact dependency identities if required. The present approved catalog set did not return those OIDs. No further database request is authorized by this report.

## Column and metadata coverage

- **507columns:**80columns across full new tables (reserve28,universe11,SOS26,PPclock15),26specified alterations,401context/output columns. Full new-table column names/order/types/nullability/defaults/identity/generated/column ACLs match; added columns also have no identity/generated/column ACL surprise. Nullability-only changes do not assert unrelated type/default equality.
- **350metadata rows:**116constraints,43indexes,176triggers,15policies. Every constraint is validated/nondeferrable/not initially deferred; every index valid/ready; all triggers enabledO. Those flags alone are not historical source equality.
- **69changed/new metadata entries** were compared to source definitions: exact key ordering, CHECK boolean grouping and enum/range literals, FK targets/actions, index method/order/direction, policies and user-trigger timing/events/target identity. The other281rows remain context/internal support.
- **168internal FK triggers** are distinguished from8user triggers. The three newly specified user triggers match: universe timestamp update, CTPIv1 freeze, SOSv1 freeze. Pre-existing helper bodies remain outside the batch.
- **81grant rows:**42explicit source contracts match,39legacy-context rows retained. New tables RLS is enabled; universe has no public policy/grants and service SIU only; reserve/SOS/PPclock public read and service SIUD. New views SELECT only; predictions view security_invoker=true.
- **6schema-role rows:**fhfh_internal denies anon/authenticated usage/create and gives service usage; public currently grants PUBLIC UC. These are pre-existing schema observations, not migrations changed by this packet.

Full new-table constraint/index/policy counts:
- `forge_reserve_projections`: 10 constraint, 3 index, 1 policy, 10 trigger.
- `forge_served_forecast_universe`: 2 constraint, 1 index, 1 trigger.
- `team_sos_daily`: 24 constraint, 1 index, 1 policy.
- `pp_team_game_clock`: 7 constraint, 1 index, 1 policy, 2 trigger.

The CTPIversion default is absent after its source DROP DEFAULT, version is NOT NULL with1/2CHECK and versioned PK; five components are nullable. Both expected_games columns and the five item6placeholder fields are nullable. Skill preserves NULL and upper-bound/non-NaN CHECK. Both PS tables carry nullable split columns with the all-null-or-coherent-v1 CHECK. PP provenance is `calculation_version` plus **computed_at**, with paired-presence CHECK. PPclock references games with update/delete CASCADE and retains all source state/count guards.

## Contextual security observations

These do not establish a new migration mismatch or a remotely reachable exploit:
- q6 reports DML/TRUNCATE/REFERENCES/TRIGGER privileges for anon/authenticated on games,goaliesGameStats,teamGameStats,powerPlayCombinations; RLS enabled and policies retained, but privileges are not themselves proof of remotely reachable writes.
- goalie_totals_unified has broad legacy ACL and no security_invoker option; source141 only replaces view definition. New136/140views have SELECT-only grants and140security_invoker=true.
- No PUBLIC execute grant in any of the six raw function ACLs; owner-only freeze helpers and service-only RPC functions match source.
- Changed user triggers enabled=O and exact timing/events/target function;168internal FK triggers are context, not arbitrary user triggers.
- Public schema effective CREATE is true for anon/authenticated/service_role because raw PUBLIC ACL includes UC. All six changed functions retain an empty search_path. A broader privilege/reachable-SQL review would need separate scope; no change or write probe was attempted.

## §7 object table

“Yes” below is limited to the stated changed contract. It never means all rows, all historical schema, real calculation results or rollback safety are verified. Rollback entries are references in pinned source comments; none was run or newly certified.

| Object / checked scope | Migration row | Applied matches source | Readback | Rollback | Finding IDs |
|---|---|---|---|---|---|
| `public.forge_player_game_strength` — three penalty-shot columns and split CHECK only | 148 | yes | q2.json rows[0], q4.json rows[23]; 5 exact pointers in JSON | supabase/tests/f15_penalty_shot_split_rollback.sql refuses while split rows stored; not run. | none established |
| `public.forge_reserve_projections` — full new28-column table,10constraints,3indexes,read policy/RLS and grants | 101 | yes | q2.json rows[1], q4.json rows[26]; 43 exact pointers in JSON | No rollback artifact named in authority101 source; unverified. | none established |
| `public.forge_served_forecast_ledger` — nullable forecast_basis and CHECK only | 138 | yes | q2.json rows[2], q4.json rows[105]; 3 exact pointers in JSON | supabase/tests/l4a_ledger_basis_universe_rollback.sql; destructive after writes; source says revert flag first; not run. | none established |
| `public.forge_served_forecast_universe` — full new11-column table,PK/class CHECK,update trigger,RLS and SIU-only grant | 138 | yes | q2.json rows[3], q4.json rows[106]; 16 exact pointers in JSON | supabase/tests/l4a_ledger_basis_universe_rollback.sql; destructive after writes; source says revert flag first; not run. | none established |
| `public.forge_team_game_strength` — three penalty-shot columns and split CHECK only | 148 | yes | q2.json rows[4], q4.json rows[132]; 5 exact pointers in JSON | supabase/tests/f15_penalty_shot_split_rollback.sql refuses while split rows stored; not run. | none established |
| `public.games` — three game-state columns and three CHECKs only | 146 | yes | q2.json rows[5], q4.json rows[143]; 7 exact pointers in JSON | supabase/tests/f4_games_game_state_rollback.sql drops state columns/data; not run. | none established |
| `public.goaliesGameStats` — four specified shot-summary columns nullable only | 147 | yes | q2.json rows[7], q4.json rows[219]; 5 exact pointers in JSON | supabase/tests/item6_game_stats_nullable_rollback.sql; source reference only, not run. | none established |
| `public.player_forecast_accountability_revisions` — nullable v2_skill numeric plus upper-bound/NaN CHECK only | 142 | yes | q2.json rows[13], q4.json rows[344]; 3 exact pointers in JSON | supabase/tests/l4a_accountability_v2_skill_rollback.sql refuses after stored skill; data precondition unqueried; not run. | none established |
| `public.player_forecast_season_player_aggregates` — expected_games nullability only | 139 | yes | q2.json rows[14], q4.json rows[354] | supabase/tests/l4a_expected_games_nullable_rollback.sql refuses after NULL rows; data precondition unqueried; not run. | none established |
| `public.player_forecast_season_release_players` — expected_games nullability only | 139 | yes | q2.json rows[15], q4.json rows[377] | supabase/tests/l4a_expected_games_nullable_rollback.sql refuses after NULL rows; data precondition unqueried; not run. | none established |
| `public.powerPlayCombinations` — calculation_version/computed_at and provenance CHECK only | 149 | yes | q2.json rows[16], q4.json rows[402]; 4 exact pointers in JSON | supabase/tests/f11_pp_team_game_clock_rollback.sql; source says revert writer first; not run. | none established |
| `public.pp_team_game_clock` — full new15-column table,7constraints,PKindex,read policy/RLS and grants | 149 | yes | q2.json rows[17], q4.json rows[404]; 25 exact pointers in JSON | supabase/tests/f11_pp_team_game_clock_rollback.sql; source says revert writer first; not run. | AFULL-SQL-04 (existing source finding) |
| `public.sos_standings` — enabled BEFORE INSERT OR UPDATE freeze trigger only | 145 | yes | q2.json rows[19], q5.json rows[305] | supabase/tests/f2_team_sos_daily_v2_rollback.sql refuses after v2 rows; not run. | none established |
| `public.teamGameStats` — powerPlayToi nullability only | 147 | yes | q2.json rows[20], q4.json rows[467] | supabase/tests/item6_game_stats_nullable_rollback.sql; source reference only, not run. | none established |
| `public.team_ctpi_daily` — five nullable components,version no-default/enum,versioned PK and freeze trigger | 144 | yes | q2.json rows[21], q4.json rows[474]; 11 exact pointers in JSON | supabase/tests/f1_ctpi_v2_publication_rollback.sql refuses after v2 rows, leaves components nullable; not run. | none established |
| `public.team_sos_daily` — full new26-column table,24constraints,PKindex,read policy/RLS and grants | 145 | yes | q2.json rows[22], q4.json rows[481]; 53 exact pointers in JSON | supabase/tests/f2_team_sos_daily_v2_rollback.sql refuses after v2 rows; not run. | none established |
| `public.goalie_totals_unified` — Manually concordant full deparse structure; exact dependency/type-binding equivalence unverified | 135→141 | unverified | q2.json rows[6] | supabase/tests/l4a_goalie_totals_regular_season_rollback.sql restores135; not run. | AFULL-SQL-01 (existing source finding) |
| `public.nst_seasonlong_5v5_counts` — Manually concordant full deparse structure; exact dependency/type-binding equivalence unverified | 136 | unverified | q2.json rows[10] | supabase/tests/l4a_nst_5v5_views_rollback.sql; source reference only, not run. | none established |
| `public.nst_seasonlong_5v5_counts_oi` — Manually concordant full deparse structure; exact dependency/type-binding equivalence unverified | 136 | unverified | q2.json rows[11] | supabase/tests/l4a_nst_5v5_views_rollback.sql; source reference only, not run. | none established |
| `public.nst_seasonlong_5v5_rates` — Manually concordant full deparse structure; exact dependency/type-binding equivalence unverified | 136 | unverified | q2.json rows[12] | supabase/tests/l4a_nst_5v5_views_rollback.sql; source reference only, not run. | AFULL-SQL-02 (existing source finding) |
| `public.predictions_sko_vdp` — Manually concordant full deparse structure; exact dependency/type-binding equivalence unverified | 140 | unverified | q2.json rows[18] | supabase/tests/l4a_predictions_sko_vdp_rollback.sql drops view; not run. | none established |
| `public.forge_league_skater_physical_totals(integer,date)` — Exact body and arguments/results/config/security/volatility/strictness/parallel/default contract; explicit grants | 88→137 | yes | q3.json rows[2] | supabase/tests/l4a_physical_totals_cutoff_rollback.sql restores88; not run. | AFULL-SQL-03 (existing source finding) |
| `fhfh_internal.reject_ctpi_v1_write()` — Exact body and arguments/results/config/security/volatility/strictness/parallel/default contract; explicit grants | 144 | yes | q3.json rows[0] | supabase/tests/f1_ctpi_v2_publication_rollback.sql refuses after v2 rows, leaves components nullable; not run. | none established |
| `fhfh_internal.reject_sos_v1_write()` — Exact body and arguments/results/config/security/volatility/strictness/parallel/default contract; explicit grants | 145 | yes | q3.json rows[1] | supabase/tests/f2_team_sos_daily_v2_rollback.sql refuses after v2 rows; not run. | none established |
| `public.persist_projection_game_derived_v1(bigint,text,bigint,text,text,jsonb,jsonb,jsonb,integer,integer,integer,text,text)` — Exact body and arguments/results/config/security/volatility/strictness/parallel/default contract; explicit grants | 148 | yes | q3.json rows[3] | supabase/tests/f15_penalty_shot_split_rollback.sql refuses while split rows stored; not run. | none established |
| `public.persist_projection_game_derived_v2(bigint,text,bigint,text,text,jsonb,jsonb,jsonb,integer,integer,integer,text,text)` — Exact body and arguments/results/config/security/volatility/strictness/parallel/default contract; explicit grants | 148 | yes | q3.json rows[4] | supabase/tests/f15_penalty_shot_split_rollback.sql refuses while split rows stored; not run. | none established |
| `public.replace_power_play_game_v1(bigint,text,timestamp with time zone,jsonb,jsonb)` — Exact body and arguments/results/config/security/volatility/strictness/parallel/default contract; explicit grants | 149 | yes | q3.json rows[5] | supabase/tests/f11_pp_team_game_clock_rollback.sql; source says revert writer first; not run. | AFULL-SQL-04 (existing source finding) |
| `public.idx_wgo_skater_stats_team_date` — Named index identity,parent,ordered columns/direction,btree,nonunique,valid/ready | 123 | yes | q5.json rows[349] | Source line28: drop named index concurrently; not run. | none established |
| `public.line_source_snapshots_observed_at_idx` — Named index identity,parent,ordered columns/direction,btree,nonunique,valid/ready | 124 | yes | q5.json rows[205] | Source lines23–24: drop two named indexes concurrently; not run. | none established |
| `public.lines_ccc_observed_at_idx` — Named index identity,parent,ordered columns/direction,btree,nonunique,valid/ready | 124 | yes | q5.json rows[206] | Source lines23–24: drop two named indexes concurrently; not run. | none established |

## Remaining evidence limits

- Five exact dependency/compiled-tree view matches remain unverified, though every full deparse diff was manually reviewed preserving grouping/operators/casts.
- No application rows, empirical query results, migration ledger entries, environment flags, current cron schedules, or rollback preconditions were read in this batch.
- 350metadata rows include baseline objects; only69changed/new entries compared to remaining authoritative source.
- update_updated_at_column and other pre-existing trigger helper bodies are outside this query set.
- No independent SHA set or source approval gap is closed by catalog hashing.

The prior batch owns authority143 terminal views and147 RPC body, alongside its other authority125–134/earlier objects. This comparison neither repeats their checks nor silently closes their remaining limits. Authority88/135 are represented by terminal137/141; catalog state is compared to terminal definitions, not obsolete CREATE text.

No extra production read is requested or performed here. Source/receipt hashes, structured comparisons and artifact schema checks are local. Chef can integrate the25yes and5unverified object rows while preserving the boundary.
