# W3 peer review: player cards, homepage stats and trade value

Reviewed 2026-11-11 on Tim's Mac in `/Users/tim/Code/fhfhockey.com`, `octoberBranch`. Fable audit: commit `961046214a`, source baseline `aeff5fab7`. Review began at `729c5607a014a567af90ce5eb6f3a96dcda011d0`. The principal inspected homepage, Top Adds, trade, Player vs Player and stats-loader files have no diff from the audit commit. Existing unrelated changes were preserved. Paths below are relative to `web/` unless stated otherwise.

## Verdict and useful changes

**Useful audit, but revise its reach, two unsupported defect claims and several proposed fixes before implementation.** The strongest actionable work is the live-reader handling of missing inputs and matched coverage, not replacing every descriptive score with trade value.

1. **M-CARD-018 is not unconditionally sound.** Actual helper-to-presentation fixtures show a missing SOG strength bucket counted as zero, and one team's fresh timestamp making the other team's stale metric visible. The same shared timestamp problem applies to xG. Production prevalence was not measured.
2. **Top Adds needs three separate dispositions.** Null projections are genuinely turned into numerical scores. Object uncertainty reaches the legacy FORGE preview and player detail, but the rail already extracts it. Week-vs-five-game mismatch is conditional on genuine five-game output being available; the API explicitly blocks substitution of one-game output.
3. **Retain D4 and extend it to per-60 coverage.** The reported 9/10 versus 10/10 total comparison reproduces. A second fixture produces a per-60 statistic from one timed game while claiming 10/10 coverage, and the final post builder returns `ready` with no reasons.
4. **Withdraw D8's mixed-unit radar claim.** The eight axes are counts on the same chosen basis; TOI, xG and percentages are not radar axes. Its disclosed raw scale is not a percentile or calibrated quality score.
5. **Narrow D6 and do not implement D7 as established.** Two players do not always beat one on raw sums. The forecast comparison already states its raw-production target and roster limitations; withholding all arithmetic nets is a product-policy choice, not a mathematical necessity. D7 confuses partial historical baseline tracks with current-window totals, which the inspected assembler requires to be complete.

“No wrong hockey number to a production user today” is not established by this audit or this review. Fable's own reported SOG comparison has eight disagreements in 112 team-games, and the audit lists other enabled numerical readers. Conversely, source reach and synthetic failures do not prove current deployed incidence. No new P0 is asserted without that evidence.

## 1. Homepage: source validity must survive the merge and presentation

### A1. Partial SOG and cross-team freshness masking — P1, enabled reader with conditional inputs

`lib/homepageGameAnalytics.ts:274-285` discards null strength buckets and sums the rest. It withholds only when **all three** are null. A fixture with `shots_es=20`, `shots_pp=null`, `shots_pk=1` becomes **21 SOG**, not unavailable. This is a partial sum, even if most saved rows happen to be complete. The audit's 104/112 agreement cannot certify the remaining rows or all future input states.

The function also stores the **maximum** timestamp across both teams (`:266-270,297-301`). `components/HomePage/homepageGamePresentation.ts:116-126` checks this shared timestamp for both values. Actual-source fixture: home SOG updated June 17, away SOG updated at the fixture clock on November 11; both values become `shotsAvailable=true`. A newly refreshed team therefore freshens its stale opponent. This is independent of the null-bucket defect. The xG merge and presentation use the same pattern.

The path is not blocked by the missing game-probability model: `enrichHomepageGames` independently reads strength and xG rows after its prediction attempt (`homepageGameAnalytics.ts:327-418`), attaches analytics, and the homepage renders live/final metrics. For finals, freshness checks are bypassed by design; that does **not** establish completion of the observed totals. The shot producer currently counts `shot-on-goal` and `goal`, excludes shootouts (`projections/derived/buildStrengthTablesV2.ts:99-100,272-293`), and validates some inputs. This does not make historical persisted rows or a partial reader merge complete. Do not reclassify SOG as all attempts or attribute the audit's eight disagreements to a particular producer version without evidence.

**Repair contract:**

- Admit a team SOG total only when each required strength bucket is finite, nonnegative and known under the selected producer version. Preserve verified zeros. Do not add EA separately without proving non-overlap under decisions 24/70.
- Retain each side's source/version, completion state and update time. A displayed pair requires both sides to satisfy the relevant live/final contract. Using the oldest timestamp of two otherwise-qualified rows can enforce a common freshness bound, but is not a substitute for identity and completion checks.
- Freeze/admit one coherent source revision where available. Do not mix provider/model revisions or accept a contradictory team ID merely because an `is_home` flag says otherwise.
- Test the actual desktop/mobile presentation after merging: all known zero, one missing bucket, one stale side, both fresh, absent side, incomplete final, and version mismatch. A fresh opponent must never change another team's data qualification.

### D1: retain stale-history/meaning drift; correct the fallback and evidence claims

`homepagePulse.ts:60-74,206-216` accepts the latest two slate dates of any age and lacks a production-model filter. The actual-function fixture with June 14/17 rows and November 11 `currentDate` emits both dates and their `|p−.5|` points. `:187-198` switches the whole series from model-vs-market observations to model confidence when there are fewer than two observations. It does not literally mix the two numeric definitions within one returned array, but the same unlabeled display changes meaning across states. Two observations can also collapse into one 15-minute bucket, so raw observation count is not displayable-series coverage.

Fable's exact “ten June placeholder predictions, .084–.103” remains **reported production evidence**, not independently reproduced here. Its limits section excludes jsonb reads, whereas the pulse also reads embedded edge values from `metadata` and `components` (`:50-57,172-177`). Absence of market-snapshot rows alone cannot prove that the confidence branch ran. It also alternates model and visitor paths when both exist, rather than displaying the model continuously (`HomepagePulse.tsx:100-126`).

**The proposed visitor fallback is not already implemented.** `activeSeries` starts as `model`; the interval starts only if both paths exist; when the model path is empty, `path` stays empty and the component returns null (`:100-128`). The actual component, with hooks/SWR stubbed and two valid visitor points but no model points, returns null on initial render. A visitor-only design needs an explicit available-series selection change, not just an empty model response.

Filter to a qualified current/bounded-age slate and admitted model, define one series meaning, and qualify issue/market timing. If the intended product is decorative visitor history, choose and label that separately. Reuse tests for stale dates, no model, one usable point, visitors-only initial state and transitions when one series disappears. No provider fetch or production model promotion follows from this review.

### D2: split today's missing state from conditional rounding

Retain the decision-42 notice gap in scheduled-game presentation (`homepageGamePresentation.ts:98-109`). Absence of a production model is exactly when the notice is needed; it is not deferred until a model is promoted. D2's pick rounding/edge behavior, in contrast, requires admitted predictions. Health already detects missing production models, as the upstream game-predictions review established; a missing homepage notice is not proof the backend is silent.

Retain the 50% tie/display fix and normal-input refutation of “less-negative edge”: complementary model and market pairs imply opposite edges. The raw-favorite implementation (`HomepageDesktopGameSlates.tsx:66-78`) can print a favored team at 50%; independent rounding of .505/.495 gives 51/50. Update desktop, mobile and the accessibility label (`homepageGamePresentation.ts:132-138`) together. Validate finite probabilities in [0,1], a coherent two-way pair, and same-game/source timing before deriving edges. Reject malformed inputs rather than normalizing arbitrary bad values into certainty.

Rounding one side and assigning the complement is a defensible display policy, but document the half-percentage boundary: .505/.495 cannot independently round half-up on both sides and sum to 100. Do not turn this display choice into a model calibration claim. Market information remains separately labeled and subject to the existing ingestion hold.

## 2. Top Adds: fix missingness and caller divergence before redefining the score

### D3 and inherited team-ratings D14: corrected reach

- **Rail (`components/forge-dashboard/TopAddsRail.tsx`)** requests horizon 1 or 5, binds the response to selected date/horizon (`:212-231,368-435`), and excludes missing ownership before ranking (`:540-543`), with a hidden-candidate disclosure (`:636-637`). It does **not** give unknown ownership a +8 bonus. It already calls `extractUncertaintyPenalty` (`:257-286,564`), taking a finite scalar or `model.skater_selection.role_continuity.volatility_index`.
- **Legacy preview (`pages/FORGE.tsx:328-371`)** still sends raw `uncertainty` into the numeric scorer. **Player detail (`pages/forge/player/[playerId].tsx:335-359`)** does so too and defaults unavailable ownership to zero. The inherited object-to-number failure belongs to these callers, not every Top Adds surface. An object fixture produces `NaN` for risk and total; JSON serializes that as null, not a valid zero.
- **All three callers** default missing count projections to zero. This undoes `buildSkaterModeledHeadTotals`' explicit missing-head policy (`lib/projections/modeledHeadTotals.ts:7-12,34-56`; `api/v1/forge/players.ts:377-394`). The API also zero-fills missing hits/blocks before callers see them. Repairing just the UI cannot recover that lost information.
- **Week-mode horizon mismatch is conditional, not demonstrated live.** `/api/v1/forge/players` queries the exact horizon, and when a requested multi-game result is absent but a one-game result exists returns `blocked` with an explicit no-relabel/no-scale message (`:337-344,432-438`). The rail honors it. A request for five does not prove five-game output exists or that it was produced by summing qualified per-game forecasts. No database state was inspected here.

**Executed magnitude:** a row with a missing ES goals head produces `points=null`; after the consumer's `?? 0`, ownership 50 and five-day ownership delta +10 generate an apparently ordinary score of **54**. An otherwise complete row with two projected points and no ownership trend scores **8.5**. The incomplete player can therefore rank above the complete one, not merely get a conservative low projection. Unknown uncertainty receives no penalty (`topAddsRanking.ts:80`), which is not evidence of low risk.

The score is explicitly an **Add score**, not expected fantasy points. Its component weights are disclosed heuristics. A five-game projection plus week schedule context can be an internally defined heuristic; the issue is whether that target matches “this week” or qualified streaming rank under decision 48. Do not infer a mathematical double count solely because a count and schedule bonus coexist. Do not adopt the audit's test that the **whole blended score ratio** must follow games left: ownership/trend terms make that false. Likewise, replacing a five-game input with one game plus an arbitrary schedule bonus does not satisfy the owner's requirement to value usable games on the same horizon.

**Repair/tests:** one shared input adapter, preserving missingness from API to scorer and every reader; a typed unavailable/incomplete score distinct from zero; numeric uncertainty semantics explicit and not presented as calibrated error; all scoring facts bound to date, player, game set and scoring profile. A streaming ranking uses qualified per-game projections over the actual usable window; demand/ownership can remain separately labeled context. Where five-game data is unavailable, keep the existing block rather than inventing it. Test the missing-head fixture end to end, both legacy callers with object uncertainty, unknown ownership versus genuine 0%, missing versus verified-empty schedule, wrong selected horizon, and exact sums over games left. Whether to maintain a separate descriptive Add score is a product choice, not permission to weaken decision 48.

## 3. Player vs Player: correct totals and prove the denominator's coverage

**D4 retained and reproduced:** ten appearances each, A with ten ixG values .30, B with nine values .32 plus one missing, produces A=3.00, B=2.88 and `higher='a'`. The total population is not matched even though the appearance counts agree (`lib/socialShare/modules/playerVsPlayer.ts:160-186`). Apply the rule to any incomplete total, including WGO counts; 90% is the default configurable NST gate, not a universal constant (`:338`, allowed 50–100). Suppress the comparison indicator/bars for partial totals or present explicitly qualified partial totals, not a reconstructed full total.

### A2. Per-60 reports numerator coverage as if it were paired exposure coverage — P1, enabled share path with conditional inputs

`metricSide` counts games with a known metric as observed, applies the NST gate, then narrows again to games with known TOI (`:161-171`). The returned `observed/missing/admitted` fields still describe the first set. The numerator and denominator are summed over the same timed subset, which is correct arithmetic; the **qualification and reported sample are wrong**.

Actual-source fixture: ten ixG values .30, only one matching 1,200-second TOI value and nine null TOI values. Result: **.90 ixG/60**, `observed=10`, `missing=0`, `admitted=true`, and “10 of 10, 0 missing” at a 90% threshold. Through `buildPlayerVsPlayer` with complete schedule receipts, the result is **`ready`, reasons=[]**. In per-60 mode time metrics themselves are excluded (`:183`), so the final WGO-missing check (`:269`) does not catch missing TOI. The normal appearance mapper retains null TOI (`shared/skaterAppearances.ts:25-26`); no upstream completeness guarantee refutes the fixture. This is a claim/coverage bug, not an assertion that .90 is numerically wrong for the one observed game.

The final card's compact legend says “Bright = higher”; detailed coverage lives beside the preview/in alt text (`:277,308-317`). An exported image should not imply a fully observed winner while relying on detached coverage text. Coordinate the metric result, builder state, card highlights/bars, export gate and alt text. Retained covered-subset rates are acceptable only when their own paired support is honestly identified and satisfies the chosen rule.

**Tests:** same exact numerator/TOI game IDs; count-only coverage never substitutes for count-plus-time coverage; all/PP use their own TOI; missing TOI, invalid/zero exposure, 9/10 NST totals, asymmetric missingness and genuine zero numerator; no false `ready` or complete-coverage text. Also protect the current behavior that comparisons use printed ties and that mismatched strength/basis/window is refused. This work must not estimate missing NST observations or issue a provider request.

## 4. Trade comparisons: descriptive arithmetic is not roster value

### D6: preserve the distinction and remove the universal claim

The preview's production 404 is verified in source (`pages/buy-low-sell-high/trade.tsx:11-24`); it supplies synthetic records in development. `compareTrade` states **raw projected production**, flags uneven sides and explicitly excludes roster/replacement effects (`lib/buyLowSellHigh/trade.ts:139-159`). The component repeats those assumptions (`components/blshTrade/BlshTradeComparison.tsx:254-259`). Category mode expressly supplies no overall winner without a league utility.

An executed 1-for-2 fixture with single-player projected production 3 and two received players at 1 each returns **net −1**, complete=true and “receive side is behind.” “A 2-for-1 always favours the two-player side” is false. Raw production subtraction remains defined for unequal counts. Conversely, equal counts do **not** establish trade value either: usable schedule, replacement availability, slot eligibility, drops, league categories and ratio denominators still matter.

There is a legitimate UX concern: `favorableForReceiver` renders “favours receiving/giving” (`:242-243`), which can sound stronger than the raw metric. Prefer “more/fewer projected [units]” and a clearly labeled raw-production difference; display roster-value verdict as unavailable unless qualified. Whether to withhold even that descriptive difference should be an explicit product decision. Decisions 76/77 define the draft replacement framework, not an authorization to insert a guessed replacement constant into this dormant comparator.

The retrospective panel correctly says recorded history, not forecast, and warns that windows differ (`:271-284`). A sum of player-specific per-appearance rates is a **sum of individual rates**, not a pooled team rate or expected production per calendar game. Label that estimand explicitly and repeat the uneven-side/slot warning if retained. Do not fix it by dividing a side's sum by player count: that produces another estimand and still is not roster value. Keep the valid pooled goalie-primitives arithmetic in forecast categories.

Retain the small zero-net wording correction (“level” instead of “ahead by 0.00”). Require complete shared issuance/horizon qualification before any forecast display; the existing UI withholds rows when `complete=false` even though internal row arithmetic may still be populated. Test the displayed contract, not merely internal `net`.

### D7: unsupported upstream attribution; do not change a valid denominator speculatively

`retrospectivePlayer` divides headline observed production by `profile.evidence.window.games` (`retrospective.ts:20-29`). An arbitrary malformed profile could supply mismatched totals and counts, but the audit does not trace such a profile from a producer.

The inspected current-window assembler instead sets `y[j]=sumOrNull(w.map(s=>s.tracks[j]))` (`buyLowSellHigh/currentWindows.ts:69,224-229`). Any missing current-game track makes that total null, not a partial sum. Production scoring and display headline require finite complete inputs (`productionReference.ts:274-285`; `displayProfile.ts:335-338`). The actual helper returns 6 for [1,2,3] and null for [1,null,3]. The earlier Astra A1 concerns **historical baseline** `trackGames` discarded by `weightedHistorySummary`, not a partial current headline admitted here.

Disposition: **unproven contract-hardening lead**, not a confirmed second instance of A1. Keep current totals and their original full-window denominator; if a future producer permits covered-subset totals, carry the track's own game/exposure identity and label that new meaning. Do not shrink the denominator to make an invalid partial total look valid. The only current route found supplies synthetic fixture profiles, and this review does not re-certify external or arbitrary callers.

M-TRD-002 remains structural: `offer.ts:80-103` computes actual after-exchange/after-drop capacities; `slotFeasibility.ts:83-104` gates on reviewed inputs and evaluates slot coverage. Those counts are not a valuation or legality/acceptance guarantee. Its focused tests passed. M-TRD-003/005 remain scaffolding under the audit's bounds, not newly certified production financial/trade advice.

## 5. Smaller dispositions that materially change the fix plan

### D8: reject mixed-unit radar; narrow the PP denominator label

`PlayerAnalysisCard.tsx:15` fixes radar/bar metrics to goals, assists, points, PP points, shots, blocks, hits and BSH. `:48-49,60-69` computes a common maximum over **those count metrics only**. They use the same total/per-game/per-60 setting. TOI is separately printed at `:70`; xG and xG% are in a different view. The audit admits it did not reread this component, and its “counts, minutes, xG and percentages” statement is incorrect.

The common count scale may emphasize high-frequency/composite categories and the axes overlap statistically, but it says “Common raw scale,” “no percentile or quality score.” Per-axis normalization or cohort percentiles would be an optional redesign with new semantics, not the fix for a demonstrated units bug. Keep the Studio classified dormant by the bounded importer check.

PP points per 60 **total ice minutes** is indeed the implemented denominator (`analysisSnapshot.ts:53-76`). Make that denominator explicit if the label can be mistaken for PP-only efficiency. Switching to PP TOI changes the estimand and requires valid matching exposure, a zero-opportunity state and source/strength tests; it is not an interchangeable formatting fix.

### D5: retain qualifier disclosure/fallback-season gap; separate policy from error

The actual rule is zero minimum through mean team GP 10, then `floor(.25*mean GP)`; unavailable/failed standings also yield zero (`lib/NHL/statsPageFetch.ts:212-250`). That error case silently relaxes qualification. The goalie season may fall back, but the threshold still uses the requested current season (`:145-187,212-250`). Label and compute the qualifier from the displayed season, distinguish deliberately no early-season floor from unknown qualification, and return enough metadata for the UI to explain it.

Ties at the cutoff are silently sliced, but the goalie read is ordered by ID and modern stable sort preserves that order (`:153-155,335-349`): the existing result is deterministic for that ordered read, not random. Showing tied fifth-place rows or documenting a meaningful deterministic tie-break is appropriate; an arbitrary input-shuffle test alone should not imply nondeterministic database output. Skater top-five boards also slice ties (`:58-63`); apply any chosen tie policy consistently.

A QS% rate is per start, while the current general goalie qualifier is appearances. That distinction should be visible, but appearances as an explicitly chosen qualification rule is not an arithmetic error. Moving only QS% to starts requires a policy/source change and query/type fields the current select does not fetch. Decision 40's shared credited-starter quality-start definition remains an upstream dependency; no new QS formula or attribution is established by this review. Keep actual source/provider evidence before declaring NHL parity.

## 6. Implementation order and release boundary

1. **Homepage reader lane:** preserve metric completeness and per-side freshness through merge and rendering; add model-unavailable state; implement one valid displayed-probability pair/tie contract. Keep xG source/model changes with the existing xG owner. Pulse filtering and series choice are separate from promoting a model.
2. **Top Adds lane:** shared typed adapter and score availability across the rail, FORGE preview and player detail, including API null preservation. Preserve absent-horizon blocking. Only then define the week objective and qualify its per-game inputs; do not patch scalar arithmetic into a prediction.
3. **Social-share lane:** totals comparability plus actual paired-exposure coverage through build state, image/highlight and export. This is the most direct extension to Fable's confirmed D4.
4. **Stats lane:** return displayed-season qualifier/tie metadata and failure states; coordinate credited QS source changes. No arbitrary rate/threshold change.
5. **Dormant trade/analysis lanes:** improve raw-quantity labels and zero-net wording if desired; retain production gates. Do not implement D7's speculative denominator change or D8's nonexistent mixed-unit fix. No replacement-value invention or fixture promotion.

Every test should verify the final reader and its availability state, not only arithmetic intermediates. No database read/write, migration, recomputation, provider fetch, remote validation, push, deployment or activation is authorized by this review. Those remain separately scoped work.

## 7. Verification, scope and reproducibility

**Passed:** 13 focused existing Vitest files, **188 tests**, with explicitly inert Supabase environment values:

```sh
NEXT_PUBLIC_SUPABASE_URL=https://unit-tests.supabase.invalid NEXT_PUBLIC_SUPABASE_PUBLIC_KEY=synthetic-public-key SUPABASE_SERVICE_ROLE_KEY=synthetic-service-role-key ./node_modules/.bin/vitest run lib/homepagePulse.test.ts lib/homepageGameAnalytics.test.ts components/HomePage/HomepagePulse.test.tsx components/HomePage/HomepageGamesSection.test.tsx lib/dashboard/topAddsRanking.test.ts components/forge-dashboard/TopAddsRail.test.tsx lib/socialShare/modules/playerVsPlayer.test.ts lib/NHL/statsPageFetch.test.ts lib/buyLowSellHigh/trade.test.ts components/blshTrade/retrospective.test.ts components/blshTrade/BlshTradeComparison.test.tsx lib/tradeAnalyzer/offer.test.ts lib/tradeAnalyzer/slotFeasibility.test.ts --reporter=dot
```

Run from `web/`. The passing suite tests current contracts; it does not clear the counterexamples or validate forecasts. No full suite, lint, typecheck, build or live browser check was needed for documentation-only work. No production datasets or provider APIs were accessed. The audit's June rows, model counts, 112 SOG team-games, 151 FORGE rows, goalie cutoff and NST-seconds sample remain reported, not independently remeasured.

**Executed new offline fixtures:** actual TypeScript modules transpiled in a VM with an explicit import allowlist, throwing network/service stubs, and synthetic inputs. The pulse component used no-op effects and initial-state/SWR stubs, so that result establishes initial render only, not browser interaction. Two harness-only attempts stopped on a missing allowed `homepageTime` dependency and on omission of `fileName` causing a generic TypeScript arrow to be parsed as TSX. After inspecting the dependency and supplying each file's real name, the whole harness passed. No source file was patched to expose a helper; `sumOrNull` was exported only in the in-memory transpilation.

This is a deep peer review of the material claims and reader paths above, not a new certification of all 40 entries. Artwork geometry, the eleven dormant/synthetic NST-registry rows, retained BLSH/card source admission and trade-value scaffolding were not independently re-audited. No fresh production reach or prevalence is asserted. The diary records checkpoints separately; this report is the deliverable.

### Reproduce the core reader counterexamples without services

The script below is the executed fixture harness. Run from `web/` with the installed TypeScript package; it performs local source reads only. `objectRisk` prints as JSON null because the asserted underlying value is NaN.

```js
const fs=require('fs'), path=require('path'), vm=require('vm'), ts=require(process.cwd()+'/node_modules/typescript'), assert=require('assert');
const root=process.cwd(), cache=new Map();
const allow=new Set([
 'lib/homepagePulse.ts','lib/homepageGameAnalytics.ts','lib/dashboard/topAddsRanking.ts','lib/projections/modeledHeadTotals.ts',
 'components/HomePage/homepageTime.ts','components/HomePage/homepageGameFormatting.ts','components/HomePage/homepageGamePresentation.ts','components/HomePage/HomepagePulse.tsx',
 'lib/socialShare/modules/playerVsPlayer.ts','lib/socialShare/modules/contract.ts','lib/socialShare/modules/shared/definitions.ts',
 'lib/socialShare/modules/shared/completeThrough.ts','lib/socialShare/types.ts','lib/rosterScheduleOptimizer/planningDates.ts',
 'lib/buyLowSellHigh/trade.ts','lib/buyLowSellHigh/productionReference.ts','lib/skoElement/contract.ts','lib/skoElement/fixtures.ts','lib/skoElement/interpret.ts',
 'components/blshTrade/retrospective.ts','lib/buyLowSellHigh/currentWindows.ts','lib/buyLowSellHigh/opportunity.ts','lib/buyLowSellHigh/supportGap.ts'
]);
const blocked=()=>{throw Error('External execution prohibited');};
const stubReact={useEffect:()=>{},useState:x=>[x,blocked],createElement:(...x)=>x};
function load(file){
 if(cache.has(file))return cache.get(file).exports;
 if(!allow.has(file))throw Error('Unlisted module '+file);
 const m={exports:{}};cache.set(file,m);
 let source=fs.readFileSync(path.join(root,file),'utf8');
 if(file==='lib/buyLowSellHigh/currentWindows.ts')source+='\nexport const reviewSumOrNull = sumOrNull;';
 const js=ts.transpileModule(source,{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText;
 vm.runInNewContext(js,{module:m,exports:m.exports,console,Date,URL,setTimeout:blocked,fetch:blocked,require:id=>{
   if(id==='lib/game-predictions/publicPredictions')return {fetchPublicGamePredictions:blocked};
   if(id==='react')return stubReact;
   if(id==='swr')return {__esModule:true,default:(url,fetcher,opts)=>({data:opts.fallbackData})};
   if(id==='styles/Home.module.scss')return {};
   const local=id.startsWith('.')?path.posix.normalize(path.posix.join(path.posix.dirname(file),id)):id;
   if(local==='lib/socialShare/modules/playerVsPlayer.candidates.json')return JSON.parse(fs.readFileSync(path.join(root,local),'utf8'));
   const resolved=[local,local+'.ts',local+'.tsx'].find(x=>allow.has(x));
   if(!resolved)throw Error('Unlisted import '+id+' from '+file);
   return load(resolved);
 }},{filename:file});return m.exports;
}
const out={};
const pulse=load('lib/homepagePulse.ts');
const old=[14,17].map((d,i)=>({game_id:i+1,snapshot_date:`2026-06-${d}`,computed_at:`2026-06-${d}T12:00:00Z`,prediction_cutoff_at:`2026-06-${d}T11:00:00Z`,home_win_probability:.6+i*.01,metadata:{},components:{}}));
out.pulse={dates:pulse.selectHomepagePulseSlateDates(old,'2026-11-11'),points:pulse.buildHomepagePulsePoints({predictions:old,currentDate:'2026-11-11'})};
assert.equal(out.pulse.points.length,2);
const Pulse=load('components/HomePage/HomepagePulse.tsx').default;
out.visitorsOnlyInitialRender=Pulse({initialPoints:[],initialVisitorPoints:[{timestamp:'2026-11-10T00:00:00Z',value:10},{timestamp:'2026-11-11T00:00:00Z',value:20}]});assert.equal(out.visitorsOnlyInitialRender,null);
const a=load('lib/homepageGameAnalytics.ts'), pres=load('components/HomePage/homepageGamePresentation.ts');
const game={id:1,gameState:'LIVE',homeTeam:{id:1,abbrev:'H'},awayTeam:{id:2,abbrev:'A'}};
const map=new Map();a.mergePersistedGameMetrics({games:[game],analyticsByGameId:map,xgRows:[],strengthRows:[{game_id:1,team_id:1,shots_es:20,shots_pp:null,shots_pk:1,updated_at:'2026-06-17T00:00:00Z'},{game_id:1,team_id:2,shots_es:18,shots_pp:2,shots_pk:0,updated_at:new Date().toISOString()}]});
out.homepageShots={analytics:map.get(1),shown:pres.getHomepageGamePresentation({...game,analytics:map.get(1)}).shotsAvailable};assert.equal(out.homepageShots.analytics.homeShotsOnGoal,21);assert.equal(out.homepageShots.shown,true);
const prediction={gameId:1,computedAt:'2026-11-11T00:00:00Z',homeWinProbability:.504,awayWinProbability:.496,homeTeam:{abbreviation:'H'},awayTeam:{abbreviation:'A'},freshness:{hasStaleSource:false}};
out.rounding={analytics:a.analyticsFromPrediction(prediction),independentRounded:[.505,.495].map(v=>Math.round(v*100))};
const score=load('lib/dashboard/topAddsRanking.ts'), totals=load('lib/projections/modeledHeadTotals.ts').buildSkaterModeledHeadTotals({proj_goals_es:null,proj_goals_pp:0,proj_assists_es:0,proj_assists_pp:0,proj_shots_es:0,proj_shots_pp:0});
const candidate={playerId:1,name:'Missing projection',ownership:50,delta:10,projectionPts:totals.points??0,ppp:totals.ppPoints??0,sog:totals.shots??0,hit:0,blk:0,uncertainty:null,scheduleGamesRemaining:2,scheduleOffNightsRemaining:0};
out.topAdds={missingHeads:totals,incomplete:score.scoreTopAddsCandidate(candidate,'tonight'),complete:score.scoreTopAddsCandidate({...candidate,delta:0,projectionPts:2},'tonight'),objectRisk:score.scoreTopAddsCandidate({...candidate,uncertainty:{model:{}}},'tonight').total};assert.equal(out.topAdds.incomplete.total,54);assert(Number.isNaN(out.topAdds.objectRisk));
const pvp=load('lib/socialShare/modules/playerVsPlayer.ts');
const games=(id,n,ixg)=>Array.from({length:n},(_,i)=>({playerId:id,name:String(id),group:'F',team:'FIX',date:`2026-11-${String(i+1).padStart(2,'0')}`,goals:0,assists:0,points:0,shots:0,hits:0,blocks:0,toiSeconds:1200,ppPoints:0,ppToiSeconds:120,ixg,iscf:0}));
const aw=games(1,10,.3),bw=games(2,10,.32);bw[9].ixg=null;
const side=(id,rows,basis)=>pvp.playerWindow(id,rows,{windowId:'l10',basis,strength:'all'});
out.pvpPartialTotal=pvp.comparePlayerWindows(side(1,aw,'total'),side(2,bw,'total'),90).metrics.find(r=>r.id==='ixg');assert.equal(out.pvpPartialTotal.higher,'a');
const partialTime=games(1,10,.3);partialTime.forEach((r,i)=>{if(i>0)r.toiSeconds=null;});
const timed=pvp.comparePlayerWindows(side(1,partialTime,'per-60'),side(2,games(2,10,.3),'per-60'),90);
out.pvpPartialTime={metric:timed.metrics.find(r=>r.id==='ixg'),coverage:timed.notes.find(n=>n.startsWith('ixG'))};assert.equal(out.pvpPartialTime.metric.a.observed,10);assert.equal(out.pvpPartialTime.metric.a.value,.9);
const ready=pvp.buildPlayerVsPlayer({settings:{pair:'manual',playerA:1,playerB:2,window:'l10',basis:'per-60',strength:'all',minCoverage:90},season:20262027,through:'2026-11-10',today:'2026-11-11',appearances:[...partialTime,...games(2,10,.3)],nst:[...partialTime,...games(2,10,.3)].map(r=>({player_id:r.playerId,date_scraped:r.date,gp:1,ixg:r.ixg,iscfs:r.iscf})),teamCoverage:[{team:'FIX',games:partialTime.map(r=>({date:r.date,completed:true}))}],candidates:{candidates:[]}});
out.pvpPartialTime.buildState=ready.state;out.pvpPartialTime.buildReasons=ready.reasons;assert.equal(ready.state,'ready');
const tr=load('lib/buyLowSellHigh/trade.ts'), records=load('lib/skoElement/fixtures.ts').fixtureRecords(10), base=records.find(r=>r.identity.modelClass!=='G');
const rec=(id,goals)=>({...base,identity:{...base.identity,playerId:id,name:id},forecastTotals:{GOALS:{expected:goals,unit:'count',reason:null}}});
const comp=tr.compareTrade({give:['single'],receive:['first','second'],scoring:{mode:'points',scoringBasis:'fixture',weights:{GOALS:1}}},[rec('single',3),rec('first',1),rec('second',1)]);
out.twoForOne={net:comp.rows[0].net,complete:comp.complete,summary:comp.summary,issues:comp.issues};assert.equal(out.twoForOne.net,-1);
const cur=load('lib/buyLowSellHigh/currentWindows.ts');out.currentTrack={complete:cur.reviewSumOrNull([1,2,3]),missing:cur.reviewSumOrNull([1,null,3])};assert.equal(out.currentTrack.missing,null);
console.log(JSON.stringify(out,null,2));
```
