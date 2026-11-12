# Independent peer review: Wave 3 misc / other

Reviewed 2026-11-11 on Tim's Mac in `/Users/tim/Code/fhfhockey.com`, `octoberBranch`. Audit: Fable's `audits/misc-other.md`, commit `729c5607a0`. Checkout advanced concurrently to `859cfb51288ed9730358618b164bdefe45304b65`; the implementation paths supporting this review are unchanged from the audit commit. Unrelated changes were preserved. Paths below are under `web/` unless explicitly repository-relative.

Scope: audit/packet, relevant owner decisions and upstream reviews, implementations and direct readers, emphasizing player aggregation, goalie share cards, route reach and homepage overlap. Not a fresh certification of all 52 entries or production data.

## Verdict

**Retain the two leading live-path findings, but do not hand the audit to a fix agent unchanged.** Player per-60/share aggregation and fabricated goalie losses are real. The proposed fixes omit parts of the actual input and consumer paths, and the audit incorrectly exempts legacy TOT shares, broadly certifies missing-data handling, and calls an unused calendar helper a live display defect.

Most material corrections:

1. **The player page fetches NST TOI but does not pass it into the merged game log.** Changing `aggregateSummaryStat` alone cannot pool the intended NST metrics. Chart rolling/index paths are separate reducers, not callers of that function.
2. **Share-card missing goalie evidence is converted to zeros.** Five unknown appearances become a 0–5 record, zero fantasy score and a COLD badge. This extends D2 and withdraws the unconditional “sound”/missingness claims for affected parts of M-MISC-013 and 043.
3. **Legacy TOT percentages are also wrong with unequal exposure.** The fixture returns CF% 50% where pooled counts imply 58.33%. Cancelling the final scaling factor does not restore the omitted TOI weights.
4. **Withdraw D12's live “every team reads poor” claim.** `getPointsClass` has no caller; the visible standings-points cell uses league rank and the adjacent percentage uses points percentage.
5. **Qualify homepage and trends reach.** LIVE-game official SOG can replace persisted SOG; the pulse is an unlabelled decorative SVG alternating model and visitor series. Trends are already sorted upstream, and `delta` means rank places, not percentile points. Hot/cold overlap remains reproducible.

Prioritize the player and share-card defects. Production prevalence and external legacy-API use remain unmeasured.

## 1. D1 retained: repair the full player-data contract

### Confirmed mathematics

`components/PlayerStats/playerStatsContract.ts:276-293` averages per-game percentages/rates. Through the actual exported helper:

| Fixture | Current | Pooled target |
|---|---:|---:|
| 1 goal in 600 seconds, 0 in 1,200 seconds | 3.0 G/60 | 2.0 G/60 |
| CF/CA 10/0, then 10/30 | 62.5% | 40.0% |

Fable's eight-player production magnitudes remain **reported, not independently replicated**.

Do not generalize the defect to every per-game statistic: mean TOI over one appearance per row is correctly `sum(seconds)/appearances`. The executed 600/1,200-second fixture returns 900 seconds per game. Pool per-60 by its exposure and each share by its own event denominator; do not blindly TOI-weight `PER_GAME_STATS` or every percentage. PDO, shooting/save percentages, faceoff percentage and zone shares have different primitives and scale conventions.

### Missing handoff: fetching columns is not retaining them

The page queries all four NST tables at `pages/stats/player/[playerId].tsx:783-800`, but its explicit merge at `:923-1022`:

- preserves WGO fields through `...wgoGame`;
- copies selected NST counts/rates/shares;
- **does not retain NST `toi`**;
- does not retain all per-60 numerators or all percentage denominators. For example, HDCF% is from `nstCountsOi.hdcf_pct`, while merged `hdcf` is assigned from `nstCounts.hdcf` and no matching on-ice HDCA pair is carried. The on-ice CF/CA and xGF/xGA pairs are carried.

Thus “counts already fetched” is useful, but not sufficient for an aggregate-only patch. Carry explicitly named, source-matched primitives and seconds through the page/type contract. Do not quietly pair WGO goals/`toi_per_game` or individual HDCF with an NST on-ice metric merely because the fields exist. Preserve season/game/team/source identity and coverage when joining by date. The audit's production observation that NST count TOI is seconds was not re-queried here; make that an explicit validated ingestion/type contract rather than infer units from magnitude in the UI.

The existing missing-value behavior also needs a stated complete-window policy. `rows` drops absent values (`:271-274`), and the shooting-percentage ratio skips incomplete pairs (`:257-268`). A valid remaining row can therefore become a numeric “season” value despite missing game evidence. Preserve metric-specific coverage and unavailable states for a claimed complete window; do not merely change arithmetic while silently retaining partial support.

### Correct the reader map

- `PlayerStatsSummary.tsx:22-35` calls the helper for selectable summary metrics.
- `PlayerSummaryStrip.tsx:64-76` calls it for that strip's fixed metrics.
- `PlayerContextualStats.tsx:131,136,235` uses it for goalie SV% and shooting percentage. Preserve its already distinct ratio behavior while revising completeness.
- **The chart does not call it.** The page creates `stat_5game_avg` with `rollingAverage` (`[playerId].tsx:175-180`); `PlayerStatsChart.tsx:128-145` draws those values. The relative panel calls `seasonIndexSeries` (`:286`), whose separate mean-game denominator and rolling numerator live at `playerStatsContract.ts:420-459`.

Executed six-game fixture: one goal in a 600-second first game followed by five scoreless 1,200-second games. At game five, the current index is **120**; pooled-window rate divided by pooled-season rate is **122.2222**. Changing the summary helper leaves this path unchanged. Choose and label the index contract explicitly: mean game-level values is a legitimate descriptive target, but it must not be represented as the pooled season rate. Counts can continue using per-game averages for the index; replacing their denominator with a season count would be wrong. Raw single-game chart points need no pooling.

**Minimum repair tests:** page merge → retained primitives → summary and chart outputs; unequal exposure; one missing numerator/exposure; zero opportunity; valid zero count; differing individual/on-ice fields; source-scale differences; selected season and traded team. Update tests currently asserting average-rate/skip-missing behavior rather than treating their current pass as mathematical approval.

### Radar and heat map

Retain the heat-map wording correction. `PlayerPerformanceHeatmap.tsx:150-170` uses fixed threshold scores with hand-set weights, not a measured cohort percentile. Its seconds-to-minutes conversion is correct.

Strict-lower percentile at `PlayerRadarChart.tsx:417-428` is a recognized percentile convention, **not an arithmetic error by itself**. Three identical values yield lower-rank percentile 0 and competition rank 1; mid-rank would be 50. Standardizing the convention is a product/consistency choice unless the contract promises mid-rank. Preserve the distinction between competition rank and percentile, and retain the NST review's stronger binding dependency: decision 15 requires matched, labelled **5v5 player and cohort** data. A tie-only patch does not repair cohort/source admission.

## 2. D2 retained and expanded: credited decisions and missing recent evidence

### Record defect and source-to-card path

`players.ts:259-263` selects the five latest positive-GP appearances, including relief. `SocialShare.tsx:329-331` prints `wins-(games-wins)`. The actual helper/formatter fixture with three wins, one OTL and one no-decision returns **3–2**, not the credited record **3–0–1**.

Reach is an authenticated share-studio workflow, not a publicly visible graphic until an owner publishes/downloads/shares one:

`pages/social-share/[format].tsx` → access-gated `SocialShare` → `pages/api/v1/social-share/[format].ts:17` → `server.ts:51-52` → `loadSharePlayerRecent`/`attachRecent` → `recentLine`, called by player tiles (`SocialShare.tsx:349`) and tier rows (`:713`). No publication was performed or inferred.

**The audit names the type, but omits the actual select owner.** Add the chosen credited decision fields to `lib/socialShare/playerSources.ts:107` `RECENT_GOALIE_COLUMNS`, as well as `players.ts:231`, `types.ts:85`, builder and renderer. Changing a `Pick<>` alone does not fetch fields. The WGO producer separately stores `losses: stat.losses`, `ot_losses: stat.otLosses` and `regulation_losses: advStats?.regulationLosses` (`fetchWGOgoalieStats.js:125-126,142`). Verify the chosen source's definitions/coverage before treating similarly named loss columns as interchangeable. Never replace missing individual decisions with `gameOutcomes` team results.

### New material defect: missing metrics can manufacture a cold streak

`attachRecent`'s `sum` at `players.ts:262` converts every null/invalid primitive to zero. The goalie recent type then makes these fields non-nullable. This contradicts the audit's fail-closed claim.

**Executed actual-source chain:** five known appearances, each with null wins, saves, shots against, GA, QS and shutouts:

- recent state is numeric zeros, not unknown;
- formatter: **`0-5 · — SV% · 0 GA · 0 QS`**;
- `fantasyPointsPerGame`: **0**, and hence an available numeric ranking input;
- `streakOf`: **COLD, `0/5 QS`**.

Partial absence can also corrupt SV% because saves and shots are independently summed; missing saves with known shots lower the ratio, while missing shots with known saves can inflate it. Null wins already enter the fictitious loss calculation. These are reachable code defects under missing-input conditions; their production frequency was not measured.

**Repair and readers:** make completeness explicit per statistic in `SharePlayerRecent`; validate integer/nonnegative decisions/counts and matched saves/shots; preserve known zeros. Record unavailable need not hide independently complete SV%. Update `recentLine`, `score.ts:21-32,46-48`, `streak.ts:37-45` and fixtures/source tests together. A score requiring an unavailable nonzero-weight component is unavailable or explicitly partial, not zero-filled. This also applies to the skater score branch's `?? 0` handling; its all-null guard does not protect a partially missing weighted sum.

Decision 40 still owns what a **Quality Start** means and requires credited starts. The recent loader does not fetch `games_started`; counting a supplied `quality_start` cannot itself certify the credited-starter/Vollman contract. Reconcile that producer with the goalie lane; do not invent a new QS formula or treat relief as a start. A “QS in last five appearances” presentation is distinct from a starts-only QS rate.

**Tests:** separate W/regulation-L/OTL/no-decision; known relief; complete zeros; missing decision only; missing each ratio primitive in a multi-game window; all-unknown and partially unknown weighted score; unknown QS cannot trigger COLD. Exercise select → builder → final text/score/streak, not the formatter alone. Keep the active social-share owner informed before source edits.

## 3. D3 retained, but withdraw the TOT-share exemption

No bounded in-repo search found a runtime page/hook calling `/api/Averages/[playerId]` or `/api/ThreeYearAverages/[playerId]`. The refactored route's imported test is lifecycle coverage; its `getAggregated*` service is otherwise read through that route. `/api/CareerAverages` is a separate live sibling, used by `useCareerAveragesStats` and owned by the sustainability workstream. The two dormant-in-repo routes remain public and invoke NST behind the lifecycle wrapper. External traffic is unknown; lack of a repo caller is not proof of no public traffic or permission to remove the endpoints.

**Confirmed through actual service with only `fetchPlayerData` replaced by fixture rows:**

- Counts path: 200 shots / 1,400.5 minutes returns **0.1428061 SOG/60**, versus **8.5683684**. `parseTime` returns seconds and the count sites multiply by 60. Keep Fable's fix at the per-season, TOT and aggregate sites and the separate old route's site.
- Rates path: 9 SOG/60 at 600 minutes plus 6 at 300 minutes produces TOT **1**, versus **8**. `addTotalRows` sums rates, then the callback treats that sum as counts.
- **New correction to Fable D3b:** team stints CF/CA per 60 of 60/20 over 600 minutes, then 20/60 over 300 minutes produce TOT CF share **0.5**. Pooled implied events yield `(600+100)/(800+400) = 7/12 = 0.5833333`. The common multiplier cancels *after the wrong unweighted rate sum*; it cannot supply the missing duration weights.

Apply exposure weighting to both rates and shares. Count-derived shares and rate-derived shares should agree on the same frozen input population and documented scale. The existing service also mixes percentage-point single-team fields with fraction-derived TOT values in places; audit all serialized rate/share fields as one versioned contract rather than multiplying every percentage indiscriminately. Multi-season unweighted rates, newest-observed-season exclusion, null/zero behavior and xS% naming remain the audit's valid repair leads; no separate live-consumer defect is claimed from them here.

**Acceptance:** two-team unequal-TOI fixtures, same-team split/merge invariance, count/rate identity, duplicate/source-TOT handling, missing season, zero exposure, and actual JSON field scales. Do not call either route for QA, because that triggers provider work. No deletion, remote log query or priority promotion is authorized by this review.

## 4. Homepage overlap: retain the bugs, narrow the claims and ownership

### D5: SOG is incomplete-support arithmetic; the sample does not identify its cause

`homepageGameAnalytics.ts:277-287` filters null parts then sums the rest. The executed `shots_es=20, shots_pp=null, shots_pk=1` fixture emits **21**, although the complete total is unknown. Numeric zero parts are legitimate; require complete, valid count components for a complete reconstructed total.

Fable's 8 discrepancies in 118 team-games are a **dated, reported sample**, not independent parity proof here. In particular, relabelling ES/PP/PK alone does not change `ES+PP+PK`. A discrepancy in the sum requires differing event coverage/attribution, duplicate/missing rows, provider revisions, scope or a non-partitioning classifier. The inspected builder sums player shot splits at `buildStrengthTablesV2.ts:407-409`; its per-play handling and roster admission must be traced before assigning a cause. Do not tell the lines/PP lane that a strength-label repair necessarily fixes total SOG.

Actual consumers:

- SSR `pages/index.tsx:624` and date-change API `pages/api/v1/games/index.js:28` call `enrichHomepageGames`.
- `homepageGamePresentation.ts:122-126` exposes SOG only for non-scheduled games, requiring freshness for live games and both team values.
- Mobile/card `HomepageGamesSection.tsx:459` and desktop `HomepageDesktopGameSlates.tsx:113` render it.
- `useHomepageGames.ts:63-83,110-121` overlays official NHL landing-page SOG for `LIVE` games when returned. Thus not every visible live SOG value comes from the persisted split. A partial overlay may also combine sources across teams; preserve source and freshness semantics.

Coordinate with the homepage/source-contract review rather than create a second independent fix. Test final versus fresh/stale live versus scheduled; official overlay present/absent/one-sided; each missing split; both team identities; SSR and hydrated/date-change paths. Do not test by making provider requests. The xG attach path is independently governed by the xG/model review and decisions 5–7; repairing SOG does not certify xG source admission.

### D6: the switching quantity is real, but the visual is decoration

Actual `buildHomepagePulsePoints` fixture with model probability .70 and market .65:

- one eligible market observation: plots **.20**, distance from .50;
- two: plots **.05**, distance from market.

The threshold counts **observations**, including embedded edges, not necessarily two distinct rendered points; bucketing keeps the maximum per 15-minute bucket (`homepagePulse.ts:76-103,172-198`). It is not an average model edge across games.

The rendered consumer is an `aria-hidden` unlabelled SVG (`HomepagePulse.tsx:130-136`), rescaled to its observed range (`:25-49`) and alternating with a visitor series when both exist (`:96-126`). Do not describe it as an explicitly labelled, calibrated probability chart, a measured user decision input, or proof of particular production model rows. `fetchHomepagePulse` reads public historical pregame rows but no model-version/qualification predicate (`homepagePulse.ts:206-216`); the exact currently returned model lineage was not inspected.

**Decision 42 is already settled.** Fable's proposed option “keep it labelled placeholder model vs market” cannot substitute for the required unavailable state while no qualified production model exists. Coordinate removal/withholding of the model-derived series at SSR and `/api/v1/homepage/pulse`, plus revalidation/fallback rendering. A harmless visitor-only decorative series can be considered independently; it is not a game forecast. Future analytical pulse needs an explicit estimand, qualified source/version, time coverage and labels.

## 5. Other material dispositions

| Audit item | Peer-review disposition |
|---|---|
| D4, M-MISC-016 | Retain conditional height carry/birthday errors. Reuse `WiGO/playerBiography.ts` with its explicit UTC/Feb-29 contract. No stored prevalence established. Do not claim malformed height is present in production. |
| D7, M-MISC-030 | Retain missing metric → percentile 0. The actual final renderer also falls back to `"0%"` (`PlayerPickupTable.tsx:1438-1440`), so changing only `computePercentile` is insufficient. Totals plus GP can reward opportunity twice, but changing totals to rates is a product/scoring choice, not a mathematical necessity. Keep ownership with the fantasy-scoring lane. |
| D8, M-MISC-041 | Retain possible hot/cold overlap. Correct the source: `teamPercentiles.ts:147` already sorts latest percentile descending; `:160` defines delta as previous rank minus current rank. It is not a two-percentile-point change. The source-extracted ranking and page selector fixture puts A (30 percentile, rank +2) in both lists. The fix is an explicit temperature/movement definition and exclusive classification if those labels promise exclusivity, not simply adding the missing sort the audit assumes. Tie-break policy can still be made deterministic. |
| D9, M-MISC-027 | Retain misleading “is downgraded” copy absent a demonstrated downstream weight change. Source dates include team-trend, CTPI, SOS and projection dates (`dataFetchers.ts:353-361`); a universal same-date requirement is not established for retrospective feeds. Define per-source freshness and projection slate alignment separately. Parsing date-only keys at UTC midnight is not by itself a timezone defect. |
| D10, M-MISC-015 | First-versus-last comparison is verified. A tolerance is a proposed presentation policy, not a proven statistical fix. Clarify label/endpoint meaning; do not introduce an arbitrary minimum without a chosen contract. |
| D11, M-MISC-024 | Shared-prefix acceptance is real (`upsert-csv.ts:77-92`), and may create identity risk after surname matching. Prefer explicit/alias identity or a reviewable ambiguity state. No wrongly imported real player was established; do not quantify prevalence from a name example. |
| **D12, M-MISC-032** | **Withdraw the live points-color finding.** Bounded symbol search returns only the `getPointsClass` definition (`TeamScheduleCalendar.tsx:2210`). Actual points cell uses `getLeagueRankingClass(league_sequence,32)` (`:1450-1456`); adjacent points percentage uses `getPointsPercentageClass` (`:1458-1462`). Dormant bad thresholds do not prove visible “poor” teams. Keep game-rating heuristic labelling as a separate question; no source deletion. |
| M-MISC-031, 033 | Retain bounded dormant classifications: game-page Poisson component is imported but not rendered; skaterVariance helper has only its test as an importer. Other Poisson helpers in Game Grid are different consumers, not proof this component is live. |
| M-MISC-046–052 | Focused category-count and goalie-period tests pass. Their explicit null-aware pooling/start-versus-relief contracts are distinct from the broken recent-form builder; do not infer one library's soundness from the other's name. No independent re-certification of every period/pool/source edge here. |
| M-MISC-001/002 and remaining inherited or lightly inspected entries | Retain the corrected upstream ownership/evidence limits. In particular, final team outcome is not an individual goalie decision. No new blanket “sound” verdict for Python research, identity scripts or uninspected module bodies. |

## 6. Fix order, acceptance and limits

1. **Player page:** explicit source-qualified primitive payload, complete-window reducers, then each summary/chart consumer. Coordinate 5v5 radar separately with NST. Test the final component/page contract, not only the helper.
2. **Social-share owner:** credited decision columns in the actual select, per-metric completeness, record/ratio/score/streak consumers together. The null→zero/COLD counterexample is an added regression requirement, not an optional tidy-up.
3. **Legacy averages:** repair count unit factors, weighted rates **and shares**, serialized scales and season membership offline; preserve routes and external-reader uncertainty.
4. **Homepage/game-model owner:** one combined source/freshness and qualification change covering SSR/API/hydration, with no assumption that split relabelling cures total counts. No placeholder-model alternative against decision 42.
5. **Small UI/policy lane:** withdraw D12's live claim; retain scoped bio/label/identity/overlap work. Set scoring, tie and trend policies deliberately; do not convert every heuristic preference into a defect.

No source edits, database/provider/production requests, commits, pushes, migrations, cron executions, builds, deployments or publication. Saved work: this review and diary. No deployed-schema, calibration or current-production incident claim.

**Passed:** 11 focused files, **251 tests**, with synthetic Supabase values and network connection denial. Expected mocked error cases in radar tests logged warnings; the suite passed. Tests included player stats contract/chart/radar; social player/source/score/streak; homepage analytics/pulse; category counts and goalie period. No full app suite, lint, typecheck or build was warranted for a documentation-only review.

**New fixtures:** actual TS helpers and source-extracted functions/callbacks, rejecting unlisted imports and replacing external functions with throwing stubs or fixture responses. Final run used the network-denying preload. Existing tests also pin current averaging/fallback behavior; a pass does not endorse it.

### Reproduce the independent fixtures

Run from `web/`. The harness below reads implementation source, transpiles in-memory, and supplies only fixture inputs. It neither invokes a route nor loads environment files. Node's local TypeScript dependency is required. This is review evidence, not an application test added to the source tree.

```sh
cat > /tmp/astra-misc-deny-network.cjs <<'JS'
const deny=()=>{throw new Error('Offline peer review: network connection forbidden')};
for(const name of ['http','https']) {const m=require(name);m.request=deny;m.get=deny;}
require('net').Socket.prototype.connect=deny;
require('tls').connect=deny;
globalThis.fetch=deny;
JS
```

Save the following as `/tmp/astra-misc-offline.cjs`, then run `NODE_OPTIONS='--require=/tmp/astra-misc-deny-network.cjs' node /tmp/astra-misc-offline.cjs`.

```js
const fs = require('fs'), vm = require('vm'), ts = require(process.cwd() + '/node_modules/typescript'), assert = require('assert');
const forbidden = (...args) => { throw new Error('External call forbidden'); };
function run(file, imports = {}, text) {
  const m = {exports:{}};
  const source = text ?? fs.readFileSync(file,'utf8');
  const js = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React}}).outputText;
  vm.runInNewContext(js,{module:m,exports:m.exports,require:id=>{ if (!(id in imports)) throw new Error(`Unapproved import ${file}: ${id}`); return imports[id]; },fetch:forbidden,console,Intl,Date},{filename:file});
  return m.exports;
}
function selected(file,names,extra='',imports={}) {
  const source = fs.readFileSync(file,'utf8'), sf=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true);
  const parts=sf.statements.filter(n=> names.includes(n.name?.text) || (ts.isVariableStatement(n) && n.declarationList.declarations.some(d=>names.includes(d.name.getText(sf))))).map(n=>n.getText(sf));
  return run(file,imports,parts.join('\n')+'\n'+extra);
}
const types=run('components/PlayerStats/types.ts',{'../../utils/formattingUtils':{formatTOIFromSeconds:forbidden}});
const stats=run('components/PlayerStats/playerStatsContract.ts',{'./types':types});
const rows=[{date:'2026-11-01',games_played:1,goals:1,toi:600,goals_per_60:6,cf:10,ca:0,cf_pct:100},{date:'2026-11-02',games_played:1,goals:0,toi:1200,goals_per_60:0,cf:10,ca:30,cf_pct:25}];
assert.equal(stats.aggregateSummaryStat(rows,'goals_per_60'),3);
assert.equal(stats.aggregateSummaryStat(rows,'cf_pct'),62.5);
console.log('Player pooling',JSON.stringify({actualG60:3,expectedG60:2,actualCfPct:62.5,expectedCfPct:40,missingCountStillShown:stats.aggregateSummaryStat(rows.map((r,i)=>({...r,cf:i===1?null:r.cf})),'cf_pct'),perGameTime:stats.aggregateSummaryStat([{date:'a',toi_per_game:600},{date:'b',toi_per_game:1200}],'toi_per_game')}));
const l6=Array.from({length:6},(_,i)=>({date:`2026-11-0${i+1}`,goals:i===0?1:0,toi:i===0?600:1200,goals_per_60:i===0?6:0}));
console.log('Separate index',JSON.stringify({actualAt5:stats.seasonIndexSeries(l6,'goals_per_60')[4],pooledAt5:(3600/5400)/(3600/6600)*100,rollingAt5:stats.rollingAverage(l6,'goals_per_60')[4]}));
const dates=run('lib/rosterScheduleOptimizer/planningDates.ts');
const attach=selected('lib/socialShare/players.ts',['isDate','count','RECENT_MAX_AGE_DAYS','attachRecent'],'const localDate = require("dates").localDate; const SHARE_TIME_ZONE = "America/New_York";', {dates}).attachRecent;
const recentLine=selected('components/SocialShare/SocialShare.tsx',['recentLine'],'exports.recentLine=recentLine;').recentLine;
const config=run('lib/projectionsConfig/fantasyPointsConfig.ts');
const score=run('lib/socialShare/score.ts',{'lib/projectionsConfig/fantasyPointsConfig':config});
const streak=run('lib/socialShare/streak.ts');
const layer={season:20262027,players:[{nhlId:1,group:'G'}]};
const games=Array.from({length:5},(_,i)=>({goalie_id:1,season_id:20262027,date:`2026-11-0${i+1}`,games_played:1,wins:i<3?1:0,losses:0,ot_losses:i===3?1:0,saves:27,shots_against:30,goals_against:3,quality_start:i<4?1:0,shutouts:0}));
const player=attach(layer,{rolling:[],goalieGames:games},'2026-11-11T12:00:00Z').players[0];
assert.match(recentLine(player,'points',{}),/^3-2/);
console.log('Goalie record',recentLine(player,'points',{}));
const missing=games.map(r=>({...r,wins:null,saves:null,shots_against:null,goals_against:null,quality_start:null,shutouts:null}));
const unknown=attach(layer,{rolling:[],goalieGames:missing},'2026-11-11T12:00:00Z').players[0];
assert.equal(unknown.recent.saves,0);
assert.equal(score.fantasyPointsPerGame(unknown),0);
assert.equal(streak.streakOf(unknown,'pickup').kind,'cold');
console.log('Unknown goalie inputs',JSON.stringify({recent:unknown.recent,line:recentLine(unknown,'points',{}),score:score.fantasyPointsPerGame(unknown),streak:streak.streakOf(unknown,'pickup')}));
const helpers=run('lib/api/averages/helpers.ts',{'lib/nst/jobLifecycle.server':{requireNstJob:forbidden},'node-html-parser':{parse:forbidden},'lib/nst/client':{buildNstUrlString:forbidden,fetchNstTextWithCacheByUrl:forbidden}});
let input;
const service=run('lib/api/averages/statsService.ts',{'./helpers':{...helpers,fetchPlayerData:async()=>input}});
(async()=>{
input={individualRows:[{Season:'20252026',Team:'AAA',TOI:'1400.5',Shots:'200'},{Season:'20262027',Team:'AAA',TOI:'1',Shots:'1'}],onIceRows:[{Season:'20252026',Team:'AAA',TOI:'1400.5'},{Season:'20262027',Team:'AAA',TOI:'1'}]};
const counts=await service.getAggregatedCountsData('fixture',false);
console.log('SOG/60',JSON.stringify({actual:counts.averages['SOG/60'],expected:200/1400.5*60}));
input={individualRows:[{Season:'20252026',Team:'AAA','Shots/60':'9'},{Season:'20252026',Team:'BBB','Shots/60':'6'},{Season:'20262027',Team:'AAA','Shots/60':'1'}],onIceRows:[{Season:'20252026',Team:'AAA',TOI:'600','CF/60':'60','CA/60':'20'},{Season:'20252026',Team:'BBB',TOI:'300','CF/60':'20','CA/60':'60'},{Season:'20262027',Team:'AAA',TOI:'1'}]};
const rates=await service.getAggregatedRatesData('fixture',false),tot=rates.yearlyData.rates.find(r=>r.team==='TOT');
assert.equal(tot['SOG/60'],1); assert.equal(tot['CF%'],0.5);
console.log('TOT rate + share',JSON.stringify({actualSog60:tot['SOG/60'],expectedSog60:8,actualCfShare:tot['CF%'],expectedCfShare:(60*600+20*300)/((60+20)*600+(20+60)*300)}));
const home=run('lib/homepageGameAnalytics.ts',{'lib/game-predictions/publicPredictions':{fetchPublicGamePredictions:forbidden}});
const m=new Map();home.mergePersistedGameMetrics({games:[{id:1,homeTeam:{id:2},awayTeam:{id:3}}],analyticsByGameId:m,xgRows:[],strengthRows:[{game_id:1,team_id:2,shots_es:20,shots_pp:null,shots_pk:1,updated_at:'2026-11-11'}]});
assert.equal(m.get(1).homeShotsOnGoal,21);console.log('Partial SOG',JSON.stringify(m.get(1)));
const pulse=run('lib/homepagePulse.ts');
const preds=[0,1].map((i)=>({game_id:1,snapshot_date:'2026-11-11',computed_at:`2026-11-11T1${i}:00:00Z`,prediction_cutoff_at:`2026-11-11T1${i}:00:00Z`,home_win_probability:.7,metadata:{},components:{}}));
const market=[0,1].map(i=>({game_id:1,game_date:'2026-11-11',captured_at:`2026-11-11T1${i}:05:00Z`,event_start_at:'2026-11-11T20:00:00Z',home_market_no_vig_probability:.65}));
console.log('Pulse fallback versus market',JSON.stringify({one:pulse.buildHomepagePulsePoints({predictions:preds,marketSnapshots:market.slice(0,1),currentDate:'2026-11-11'}),two:pulse.buildHomepagePulsePoints({predictions:preds,marketSnapshots:market,currentDate:'2026-11-11'})}));
})().catch(e=>{console.error(e);process.exitCode=1});
const ranking=selected('lib/trends/teamPercentiles.ts',['buildRankingsFromSeries'],'exports.build=buildRankingsFromSeries;').build;
const teamRankings=ranking({A:[{gp:1,percentile:10},{gp:2,percentile:30}],B:[{gp:1,percentile:20},{gp:2,percentile:20}],C:[{gp:1,percentile:30},{gp:2,percentile:10}]});
const sf=ts.createSourceFile('trends.tsx',fs.readFileSync('pages/trends/index.tsx','utf8'),ts.ScriptTarget.Latest,true);
let temperature;
function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(sf)==='teamTemperature')temperature=n.initializer.arguments[0].getText(sf);ts.forEachChild(n,visit);}visit(sf);
const temp=run('trends-temperature',{},'const teamTrendRankings='+JSON.stringify(teamRankings)+';exports.result=('+temperature+')();').result;
assert.equal(temp.hot[0].team,'A');assert(temp.cold.some(t=>t.team==='A'));
console.log('Sorted trend overlap',JSON.stringify({rankings:teamRankings,temperature:temp}));
```

Focused existing-test command, after creating the network guard above:

```sh
NODE_OPTIONS='--require=/tmp/astra-misc-deny-network.cjs' NEXT_PUBLIC_SUPABASE_URL=https://unit-tests.supabase.invalid NEXT_PUBLIC_SUPABASE_PUBLIC_KEY=synthetic-public-key SUPABASE_SERVICE_ROLE_KEY=synthetic-service-role-key ./node_modules/.bin/vitest run components/PlayerStats/playerStatsContract.test.ts components/PlayerStats/PlayerStatsChart.test.tsx components/PlayerStats/PlayerRadarChart.test.tsx lib/socialShare/players.test.ts lib/socialShare/playerSources.test.ts lib/socialShare/score.test.ts lib/socialShare/streak.test.ts lib/homepagePulse.test.ts lib/homepageGameAnalytics.test.ts lib/socialShare/modules/shared/categoryCounts.test.ts lib/socialShare/modules/goaliePeriod.test.ts --reporter=dot
```
