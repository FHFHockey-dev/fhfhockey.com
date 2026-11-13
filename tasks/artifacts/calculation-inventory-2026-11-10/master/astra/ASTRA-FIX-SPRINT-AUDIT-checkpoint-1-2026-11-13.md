# Independent frozen fix-sprint audit — blocker-first pass

Source: **master `4d9b6a10d2c8100bb5551e7034afaa4467a08fa7` (#433)**. Audit date: 2026-11-13.

**Verdict: do not accept the sprint as fully closed.** The pinned tree still has a P0 reader gap and several demonstrable P1 defects. This is a blocker-first audit with **incomplete exhaustive coverage**, not a certification of all 1,358 calculations or every lane finding. No new production failure or prevalence is asserted from synthetic examples.

The highest-priority gap is RSO's goalie bridge: it does not consume the new per-candidate contract and can still assign a team starter's line to another goalie. The new opponent-goalie reader also changes missing goals against into zero. FORGE's goalie outcome model bypasses the shared 50/50 OT rule. Those findings are in the frozen release, irrespective of what today's in-flight lanes may fix.

## Scope, evidence and work performed

- Read the current audit prompt, debrief, lane index and relevant lane briefs, rules and owner decisions, production plans/queue, migration authority and selected SQL proof sources. Later working documents are used only to identify claims and provenance. In-flight F5–F10, decisions 144–146, PP-clock validation and Codex dev work were not audited.
- Exported the specified commit with `git archive` to this private temporary directory. All source references below refer to that export. Inspected the stall-fix commit `a25f3f542` as historical evidence and its released implementation. No checkout switching, Git mutations, diary/mailbox edits, application changes or production operations.
- Verified #433's tree equals candidate `359789456`: both tree IDs are `21d30df7b96eee907f1e0727c0d9803efbb2a2e2`. This proves source equality, **not deployment or alias assignment**.
- Recomputed SHA-256 for authority rows **88, 101, 123–146: 26/26 match**. Frozen authority has 146 rows: 112 applied claims, 6 pending, 28 unknown. See `migration-hashes.tsv`.
- Ran `node offline-probes.cjs` successfully under Node 22.23.4. It transpiles exact exported TS modules, with an in-memory Supabase fixture and an empty module environment. It makes no service/network calls and exposes no credentials. Findings and numeric outputs are in `offline-probes.json`; this is a focused reproducer, not the repository test suite.
- Inspected relevant existing tests and SQL proof/rollback code. **Not run:** Vitest, pytest, tsc, lint, PostgreSQL proofs, browser tests, local servers, builds. No pre-fix/post-fix mutation run was performed. Reported sprint test totals remain author claims.
- **No production/provider/network reads or writes, no deployments/builds, no application requests.** No approval was requested or rejected during this audit.

### Coverage boundary

This pass checks P0 closure claims against representative implementation and reader paths, deeply traces the findings below, checks migration hashes and selected migration semantics, and evaluates production evidence limitations. It does **not** complete a finding-by-finding proof for every lower-priority item, all readers, all historical lane diffs, all handoff files, coordination entries or diaries. In particular, exhaustive L13b, L15 Python/TS parity, L18 modules other than the selected Crease Shift path, and L21/BLSH wiring remain open. Do not convert an unverified row below into an acceptance.

## 1. Findings, most severe first

| ID | Severity / reach | Lane | Claim checked | Pinned evidence | What's wrong | Suggested fix / acceptance proof |
|---|---|---|---|---|---|---|
| AF-01 | **P0**, reachable RSO bridge; production frequency unmeasured | L9b / L11 | W1 #20 fixed; all goalie readers updated | `web/lib/rosterScheduleData/forgeDailyBridge.ts:364`, `:619`, `:669`, `:683`, `:838`; debrief §11 acknowledges contract not wired | Bridge reads `l10_start_pct`/season shares, builds its own vector, chooses an exact/reserve/latest/team goalie line, and explicitly permits a different goalie's team line. It reconstructs wins from team probability × decision share. The new candidate writer/API does not fix this reader. Labelling a fallback does not satisfy the one-line-per-candidate decision. | Consume the released per-candidate if-starts/participation/unconditional contract. Never substitute another candidate's stats as an individual forecast. Test final bridge output with two distinct candidate lines, an absent candidate and partial probability mass. Reopen W1 #20 for this consumer. |
| AF-02 | **P1**, live FORGE input path | L9a | W1 #21: independent matched goalie history; unknown stays unknown | `web/lib/projections/opponentGoalieQuality.ts:116–128`; nullable source columns in baseline SQL `:8372`; probe `nullGoalieHistory` | `Number(row.goals_allowed)` converts null to 0 before validity filtering. A row `{shots_against:30, goals_allowed:null}` becomes a 30-shot shutout. The comment that both values must be known is false. Fixture multiplier becomes 0.9950248756 instead of neutral/no evidence. | Reject null/undefined/empty/non-numeric inputs before conversion; require valid matched integer counts. Exercise the query adapter and final skater payload, not just posterior math. |
| AF-03 | **P1**, non-market goalie outcome path | L9b / L12 / L22 | One shared OT rule, decision 45 | `web/lib/projections/goalie/goalieOutcomes.ts:121`; called by `stages/goalie-stage.ts:384`; shared rule `web/lib/game-predictions/overtimeRule.ts:10`; test `goalieOutcomes.test.ts:51–63` | FORGE uses `f/(f+a)` for OT; Game Grid uses 50/50. Existing complement/monotonicity tests pass both policies and cannot establish compliance. Fixture λ=(4,2), keeping existing shrink/tie inflation unchanged: actual .7380469927 vs .7147543100 with 50/50; **+2.3293 percentage points**. | Route the tie allocation through the shared rule; preserve any separately justified regulation/tie model. Test unequal teams against a frozen regulation distribution. No held-out evidence was found authorizing this different OT split. |
| AF-04 | **P1**, conditional on market data use; do not resume ingestion on this basis | L9a-markets / L9b | Same-book odds pairing fixed | `web/lib/projections/queries/market-queries.ts:129`, `:152–196`; `goalie/goalieOutcomes.ts:129–150`; `goalie-stage.ts:381`; probe `marketWithoutMatchedBookOrTimestamp` | The goalie path de-vigs per-outcome averages. The goalie reader uses averages even though the summary retains per-book quotes; disjoint books can produce a plausible pair. At `market-queries.ts:129`, no fresh rows falls back to all stale rows. The full-adapter probe accepts two expired, disjoint-book offers as .5; the goalie helper also accepts absent timestamps. L22's correctly paired schedule-odds reader does not repair this separate FORGE consumer. | Derive probabilities from complete, fresh, same-book pairs before aggregation; reject unmatched/stale input. Add disjoint-book and mixed-age fixtures to the goalie served-output tests. Confirm effective market flags before claiming live exposure. |
| AF-05 | **P1**, shared skater readers | L9a / L10 / L11 / L12 | Missing heads remain unknown after PK writer lands | `web/lib/projections/modeledHeadTotals.ts:12`; bridge import `forgeDailyBridge.ts:4`; probe `pkMissing`; debrief §13 | ES=.2, PP=.1, PK=null produces .3. Legacy rows with unmodelled PK and new rows missing PK are indistinguishable. A new writer plus a subsequent successful FORGE run does not change this code. The debrief's temporary deferral predates its own later run claims. | Version-aware admission: require PK for the new all-situation contract, label/withhold legacy partial totals, and keep PP-only totals independent. Test all final consumers with one missing PK head. Do not blanket-change the helper's optional argument without considering `ppPoints`. |
| AF-06 | **P1**, model validation/closure gap | L9a | W1 #21 fully fixed statistically | `opponentGoalieQuality.ts:15–18`, `:42`, `:75`; `skater-stage.ts:1976–1979`, `:2342`; lane L9a wording | Independent history and prior shrinkage are improvements, but the new goal/assist multiplier explicitly says `full_multiplicative_unvalidated` and is applied. A fitted save-percentage prior does not validate full pass-through into skater finishing. `skater-stage.strengthBuckets.test.ts:219` checks the implemented mixture on a synthetic fixture; it is a useful arithmetic regression, not held-out validation. The debrief concedes the held-out check is backlog. | Mark #21 partly fixed until a time-ordered comparison evaluates the final skater output against neutral/previous baselines with uncertainty. Any interim serving exception needs an explicit owner decision, not a metadata label alone. |
| AF-07 | **P1**, strength consistency / conditional penalty-shot event | L1 / L9a | One classifier for events and exposure | `web/lib/supabase/Upserts/nhlStrengthState.ts:143`; `web/lib/projections/derived/situation.ts:42`; `derived/buildStrengthTablesV2.ts:276–286`; probe `penaltyShotClassification` | Two classifiers remain. For `1010`, the canonical classifier gives manpower=null, while derived counts give ES; the derived builder filters shootouts but has no corresponding penalty-shot exclusion there. Exposure additionally comes from the penalty-clock path. This disproves one shared definition; it does not imply a penalty-shot goal should disappear from all-situation official totals. | Define the intended penalty-shot attribution explicitly, preserve legitimate all-situation goals, and use shared strength/net-state adapters with oriented event/time fixtures. Audit post-expiry OT boundaries separately; not completed here. |
| AF-08 | **P1**, incomplete finality rollout | L2 / F4 / L5 | Finished-game rule fixed across consumers | `teamStatsSummaryRefresh.ts:1132`, `teamStatsQueries.ts:1023`, `teamUnitToiNightly.ts:149`; `games/gameFinality.ts:125` | Landing/detail use the new contract, but the named summary/matrix writers still infer completion from dates. Even the shared helper intentionally marks a stale LIVE state final after 8 h. That fallback is labelled and in F4's remit; it is not authoritative finality. | Complete the already-listed consumer follow-up; test UTC rollover, delayed/postponed games, unknown state and stale LIVE at each served boundary. Do not describe #433 as repository-wide finality closure. |
| AF-09 | **P2**, acceptance/evidence | Cross-lane | 40 P0s fixed; complete recovery, approvals and deployments proved | Current debrief §§3,5,7,8,13; frozen queue; HEADS TSV | Status sections contradict later sections. The heads TSV contains 453 changed-head records for 257 games, not a complete 298-game post-recovery manifest. Counts/revision tags and prose do not prove every source lineage, byte-preserved history, owner approval or deployed SHA. | Reconcile the acceptance register to exact source/version and retained machine receipts. Preserve original owner approvals and post-action records. Keep evidence-unverified separate from code-defective; do not infer an action was unauthorized merely because its primary receipt is absent here. |

## 2. Per-lane verdicts

“Accept with findings” below means the **inspected slice** is consistent with its stated remedy, subject to the listed findings/coverage limits. It is not blanket signoff. “Reject” rejects the claimed closure, not every change in the lane.

| Lane / sublane | Verdict | Basis and remaining scope |
|---|---|---|
| L1 | Accept with findings | Away-first/team-oriented manpower, score/penalty and house-metric changes are present; AF-07 prevents cross-lane closure. Placeholder readers and Python EV_TOI remain declared leftovers. |
| L2 / L2-landing | Accept with findings | Aggregate goalie GSAA and MD/LD correction present (`playerStatsLandingServer.ts:5019`, `:5220`); rev-2 admission and F4 reader tests present. AF-08; full summary/source lineage not proved. |
| L3 | Accept with findings | `skaterMetrics.ts:239` pools individual SAT rate using 5v5 TOI and names its source. The report itself says the rate's strength basis is unverified; a source label cannot establish matched exposure. Treat W2-P0-8 as conditional pending that source contract. |
| L4a | Accept with findings | All checked migration hashes match. 125–143 source changes/receipt descriptions are consistent with the intended SQL remedies; see migration section. No hosted definition proof or complete independent SQL regression run. |
| L4b | Accept with findings | Radar uses same 5v5 player/cohort source, shared mid-ranks and separate unavailable/minimum states (`PlayerRadarChart.tsx:253`, `:338`). PP60/PK120 decision replaces provisional floor. Full WiGO rebuild coverage and held-out floor analysis not reproduced. |
| L5 / L5a / L5b | Accept with findings | Window support counts, aggregate GSAA and strength-specific metric definitions present. L6 support tests address rate/count confusion. AF-08 affects nightly units; complete composite, EN-credit and team-matrix reader proof still open. |
| L6 | Accept with findings | `/3600` rate reconstruction and explicit count support present; `rollingPlayerMetricMath.test.ts:29` and window aggregation tests use non-tautological unequal exposures/counts. Full calendar/trend reader and source coverage remains unverified. |
| L7 | Accept with findings | Usual range explicitly `validated:false`, pre-window basis; history rebuild records exist. No predictive calibration claimed here. Trend-band unit and career aggregation regression execution not independently repeated. |
| L8 / F3 | Accept with findings | Goalie SV/GAA/credited W-L-OTL pooled with unknown propagation (`utilities.ts:581`); PP share withheld by `/api/toi`; disjoint 5v5 flag true and latest complete units selected (`fiveOnFiveUnits.ts:13`, `:76`). Visual QA, other Lines labels and full two-game fallback proof remain open. |
| L9a | **Reject as fully fixed** | AF-02, AF-05, AF-06, AF-07. PK writer/physical allocation improvements do not close missing-head readers or validation. |
| L9a-markets | **Reject as cross-consumer closure** | AF-04. Corrected market flags/yes-only de-vig do not establish goalie odds pairing. Keep dormant paths dormant until validated. |
| L9b | **Reject as fully fixed** | AF-01 and AF-03; #16/#17 already partial. Credited-start and candidate contracts are valuable but incomplete adoption remains. |
| L9c | Accept with findings | Coverage/availability separated; reserve activation is a production claim. No-history R3 remains unknown; do not call eligible-universe coverage complete without per-game readback. |
| L10 / L10b | Accept with findings | Shared proper scoring, explicit boxscore identity/finality, null bounds and versioning found in settlement paths. AF-05; full forecast-basis/calendar adoption and importer manifests not exhaustively checked. |
| L11 | **Reject as full consumer closure** | Projection-only ranking and unknown drop treatment improved; loss/OTL remain null appropriately. AF-01/05 and registry wiring remain. |
| L12 | Accept with findings | Prior after all-team normalization, pooled ST, Top Adds typed incompleteness and odds withholding present. Decision125 sanctions unfitted GP10 ramp. AF-03 cross-lane; all-situation EN goaltending is explicitly still open at freeze. |
| F1 | Accept with findings | Versioned writer, v1 freeze, candidate gating present; **default Recent Team Form intentionally serves no candidate rows** (`ctpiVersions.ts:49`, `:71`). Approval/validation and any successor publication are outside this pass. |
| F2 / F2b | Accept with findings | SOS final-only/pending split, equal fixture weighting, head-to-head exclusion and v2 storage/readers present. 84 fixtures is a recorded current-season fact, not an 82-game invariant. Full source timestamps/as-of reconstruction not independently proved. |
| F4 / D13 | Accept with findings | Stored finality, labelled fallback and chart-vs-table TOI tests present (`playerStatsLandingServer.test.ts:296`, `:2118`). AF-08. |
| L13 / L13b | Accept with findings | No second category shrink; ratio impact uses own exposure; draft VBD=VORP and VONA separate (`useVORPCalculations.ts:324`). Exhaustive provider directions, all ranking consumers and replacement allocator verification remain open. |
| L14 | Accept with findings | Active approved registry selector pins model+feature version and handles absence. No leak-free v2 model is established; demotion is a receipt claim. Shot-map and all aggregate/EN readers not exhaustively reverified. |
| L15 | Accept with findings | TS joint-draw aggregate version and nullable targets present. No independent Python twin/golden-vector or held-out evaluation run; cannot close every F1–F9/PR claim. |
| L16 | Accept with findings | Owner-sanctioned absence of a qualified game model is appropriate; exhaustive pulse and strength-coverage proof not completed. |
| L17 | Accept with findings | `aggregateSummaryStat` pools declared primitives, rejects incomplete support and withholds multi-game undeclared rates/shares. W3-P0-1 correctly remains partial. |
| L18 | Accept with findings | Crease Shift carries official starter labels and short-window disclosure. Remaining social-card definitions and every credited-record consumer not exhaustively checked. |
| L19 | Accept with findings | Explicit NST minute/second and pooled-share adapters present; traded/TOT layout still requires source validation. Legacy-route usage unknown. |
| L20 | Accept with findings | VDP v0.4 labelled compatibility/unvalidated, view additive. IPP root cause and cron resumption remain open; no deletion justified. |
| L21 | Accept with findings | Versioned observational/forecast contracts and nullable inputs present. BLSH adoption remains unverified; no claim of finished sKO/VuDu model validation. |

## 3. All 45 P0 status checks

Legend: **Supported** = inspected code supports the narrow remedy, not an executed full regression or production certification. **Partial/disputed** = the complete closure claim is too strong. **Unverified** = insufficient independent inspection in this pass. Production rebuild counts throughout are recorded claims only.

| P0 | Debrief claim | Audit disposition / evidence |
|---|---|---|
| W1 #1 xG leakage | Code fixed, demotion pending | **Supported selector; production unverified.** Registry approval/model+feature pin present; later queue claims retirement. No v2 model. |
| W1 #2 heuristic xG | Display retired | **Unverified all readers.** Hidden parity/team computation intentionally retained; distinguish NST headline from in-house availability. |
| W1 #3 mirrored shot map | Fixed | **Unverified** coordinate/display chain in this pass. No independent before/after fixture. |
| W1 #4 score state | Fixed, rebuild | **Supported in inspected parity/summary design;** whole reader and data closure unverified. |
| W1 #5 goalie GSAA | Fixed | **Supported:** aggregate SA × league failure rate − GA, not heuristic xGA; `playerStatsLandingServer.ts:5019`, `:5222`. |
| W1 #6 penalty classes | Fixed | **Supported inspected classifier:** penalty shot excluded as infraction, misconduct/minor distinctions; `nhlNstParityMetrics.ts:413`. |
| W1 #7 NST names | Fixed via house definitions | **Supported semantic remedy:** house metadata `nhlNstParityMetrics.ts:456`, rush separate from xG feature. Not proof of NST equivalence. |
| W1 #8 radar cohort | Fixed | **Supported:** same NST 5v5 source for player/peers, unavailable states; production WiGO coverage unverified. |
| W1 #9 60× fallback | Fixed, rebuild | **Supported:** `rollingPlayerMetricMath.ts:25` reconstructs rate × seconds / 3600; regression fixture inspected. |
| W1 #10 luck count/rate | Fixed, rebuild | **Supported contract:** explicit window support; full publication unverified. |
| W1 #11 trend scales/calendar | Fixed, rebuild | **Unverified full reader/calendar coverage.** Explicit support and adapters inspected, not all trend routes. |
| W1 #12 slate normalization | Fixed | **Supported:** all-team baseline, prior after normalization; GP10 ramp owner-sanctioned decision125, not fitted evidence. |
| W1 #13 ST single-game tiers | Fixed | **Supported:** pooled input/tie-rank path `power-ratings.ts:927`; data recompute unverified. |
| W1 #14 Game Grid odds | Partial | **Confirm partial.** Data withholding/Week Score null odds present; labels/remaining UI are later work. |
| W1 #15 Top Adds NaN | Fixed | **Supported typed adapter/scorer:** `topAddsRanking.ts:98`, `:169`; AF-05 limits head completeness. |
| W1 #16 starters | Partial | **Confirm partial.** No refit, prospective immutable issuance/calibration proof or accuracy-job completion established. |
| W1 #17 L10 share | Partial | **Confirm partial.** Relabel is not calibrated P(start); AF-01 shows another L10 consumer. |
| W1 #18 omitted PK | Fixed writer | **Partial at system level:** new heads exist, but AF-05 preserves unknown-as-zero readers. Do not revert genuine PK additions. |
| W1 #19 double PK hits/blocks | Fixed | **Unverified final serialized allocation** across every manpower/EA case; no independent counterexample test executed. |
| W1 #20 goalie team slot | Fixed | **Dispute complete closure: AF-01, P0.** Candidate contract not adopted by RSO. |
| W1 #21 .900 goalie lever | Fixed, validation backlog | **Partial/disputed:** independent posterior path present, AF-02 null bug and AF-06 unvalidated pass-through. |
| W1 #22 Power Terminal | Fixed | **Unverified complete UI/chart path** in this pass. |
| W1 #23 trend-band TOI | Fixed, rebuild | **Unverified numeric rebuild and complete unit path** independently; 666,376-band claim is not a unit oracle. |
| W1 #24 Sandbox status | Fixed | **Supported** usual-range contract has `validated:false`, separate descriptive status. |
| W1 #25 charts career average | Fixed | **Unverified full career-page path**; do not infer from test-count claim. |
| W1 #26 streaming blend | Fixed | **Supported projection-only rank** (`streamingChain.ts:187`); full planner optimization not re-executed. |
| W1 #27 no line as zero | Partial | **Confirm partial.** Unknown no-line emission present, R3 no history remains unknown, reserve population coverage not proved. |
| W1 #28 losses=1−W | Fixed | **Supported:** explicit L and OTL null (`forgeDailyBridge.ts:683`); wins/start basis still affected by AF-01. |
| W1 #29 idle boost | Fixed | **Unverified all pickup/normalization readers** in this pass. |
| W1 #30 z attenuation | Fixed | **Supported inspected scorer:** no second shrink, own exposure ratio impacts, null missing categories; remaining providers unverified. |
| W2-P0-1 NST season views | Fixed | **Supported SQL definition/hash:** migration125 regular-season scoping. McDavid 99→67 is retained claim, not independently read. |
| W2-P0-2 orientation | Fixed | **Supported team-oriented helper; partial cross-lane:** AF-07 independent derived classifier remains. |
| W2-P0-3 MD/LD GA twice | Fixed | **Supported:** MD/LD derived once as shots−saves (`playerStatsLandingServer.ts:5220`). |
| W2-P0-4 skater PK filter | Fixed | **Unverified complete served filter combinations** in this pass. |
| W2-P0-5 team score TOI | Fixed | **Unverified complete segment-boundary proof** independently. |
| W2-P0-6 PP%/PK% landing | Fixed | **Unverified full landing numerator/denominator selection** independently. |
| W2-P0-7 nulls first | Fixed | **Unverified all sorting readers** independently. |
| W2-P0-8 variance CF/60 | Fixed with source label | **Partial:** weighted iCF rate code present; pairing the source rate with 5v5 TOI still requires the source basis to be verified. |
| W2-P0-9 matrix GSAA/60 | Fixed | **Supported:** aggregate GSAA over selected league window and NST minutes (`goalieMatrix.ts:697`, `:1093`); migration141 fixes regular-season coverage. |
| W2-P0-10 team heuristic xG | Fixed NST 5v5 | **Unverified complete team-matrix source/reader chain** in this pass. |
| W2-P0-11 last-N rate as goals | Fixed | **Supported** explicit support counts and frozen same-20-games regression; `skaterWindowAggregation.test.ts:264–356`. |
| W2-P0-12 Lines goalie | Fixed | **Supported** pooled appearances and credited decisions (`utilities.ts:581–634`). |
| W2-P0-13 PP share | Withheld | **Supported `/api/toi`**, observed time/share nullable; model split explicitly separate. No qualified clock established. |
| W2-P0-14 draft VONA | Fixed | **Supported:** VORP base, VONA separate, frozen reference; `useVORPCalculations.ts:140`, `:324`. |
| W3-P0-1 stats pooling | Partial | **Confirm partial:** `playerStatsContract.ts:359`, `:394–422` pools known primitives and withholds undeclared multi-game shares. |

The debrief's “40 fixed” count cannot be independently affirmed by this pass, and AF-01 directly contradicts complete closure of at least one such row.

## 4. Production actions versus approval and retained evidence

**Evidence standard:** the named approvals below are quotations/attributions in repository records. No original owner-popup transcript, live DB/log read, provider call or deployment API verification was obtained. “Consistent” means plan/code and recorded action agree at the inspected level, not that execution/authorization was independently authenticated.

| Action | Recorded owner approval / bounds | Retained claim and audit result |
|---|---|---|
| Migration88, then137 cutoff successor | Q3 / decision119 “Apply now”; individual migrations | Hashes match; 137 is necessary to close prior-season cutoff. Apply/prosrc claims not independently verified. |
| 125–136,138–140 | Individual “Apply now” actions | Authority records transaction/readbacks. Required 134/136/139-before-code order recorded. No live proof. |
| #430 release | Push/merge and five-GET budget recorded | Candidate/deployed/build counts are recorded; not independently checked against deployment service. |
| Initial 2026-27 goalie rebuild | “Run as planned”; 44 dates, one table | 298 games/14,094 rev2 partitions claimed. Actual partitions roughly 5.9× initial estimate (~2,400); elapsed time reportedly stayed bounded. It occurred **before** strength-v2 renormalization, so this receipt alone cannot prove v2 source events. |
| 141 goalie view | Separate apply approval | Source restores regular-season population; 73→97/98 coverage claim credible but not read here. |
| Strength renormalization / incident1 | Windowed plan, then explicit disclosed/reapproved single-game resume | Atomic normalization RPC supported by source; first window pacing/active-count guard insufficient for I/O. Stop/reconcile/slow resume was directionally sound. 146 v2/152 v1 then298 v2 are claims, not complete manifest proof. |
| 11 official-HTML OT recoveries | One-game choice then bounded ten-game extension recorded | Plan checks game/team/player identity, no overlap, both-team period coverage, ES and GS TOI ±1s, exact capture requalification, preserved JSON. Pinned RPC is atomic **after** separate raw capture/head update. A capture can leave status stale; do not conflate raw capture plus normalization with one transaction. Actual HTML bytes/parser outputs not independently replayed. |
| Team/player/goalie summary refresh after v2 | Serial step4, 298 games | 41,720 team rows/43,764 player partitions/298 goalie rev2 claimed after v2. FormulaRevision2 is an algorithm marker, not itself a source-head fingerprint. Need game-level lineage confirmation. |
| Codex DRM/Goalie Grid and H1 | Separate tasks, outside audit except interfaces | No independent authorization or execution verdict on those tasks. Alias incident matters to which code served. |
| Cron327 pause + goalie snapshot refresh | Decision129, separate write recorded | Pause and 402→476 rows claimed. Current state unverified; do not resume implicitly. |
| 2025-26 goalie partitions | Summary-only paced rebuild approved | 213 calls, 1,394 played games,65,164 rev2 partitions claimed; 23 if-necessary games excluded. Stopping on absent partitions then reconciling before resume is sound. **Strength-v1 source remains**; rev2 does not mean strength-v2. |
| 00:25 production alias restoration | “Restore now”; promote existing original deployment, no build | Queue names old/new deployment IDs and healthz. Narrative is consistent with restoring project env. A healthz200 cannot prove alias target/environment, nor prove no H1 request occurred. |
| #431 / #432 | “Push and merge” recorded | One build+three cancels each claimed. #432 smoke stopped on homepage timeout; recovery smoke recorded separately. Do not summarize that as uninterrupted5/5. |
| Cron305 10:05→10:25 | “Move305 to10:25” | Pinned inventory says25 10; Vercel slots are5,10,15,20,30,35,40,45,55. **Exact-minute clash removed in declared schedules.** This is not proof of no runtime overlap or duplicate work; inspect job timing/persistence leases before asserting more. |
| 142/143 | “After the rebuild” | Signed nullable skill and team-of-record views present; original approvals/live definitions not independently observed. |
| Rolling recompute / incident2 | “Dry run, then run”, “Run with bypass”; subsequent resume decisions recorded | Slow runner stops on non200/uncertain result, >200s and slow streaks; 8-player batches/60s gaps. Reported uncertain call21 correctly required reconciliation/idempotent resume. Final764 skaters and10,727 rows/strength are claims. Guards measure current latency/waits, not host memory/WAL pressure; root cause still unproven. |
| Reserve migration101 and flag | “Table now, flag next release”; flag reportedly set before#433 | Table/hash/grants inspectable; env/deployment activation and actual reserve output not established offline. No-history unknowns remain. |
| Index124 then123 | “All steps now”; 123 concurrent and alone | Source headers allow concurrent manual variant. Claimed2s/37s valid/ready indexes are plausible; exact catalog state unverified. |
| Power ratings v3 |45 daily calls09-29..11-12|1,440 v3 rows claimed; legacy/v2 replaced. Retain this explicit historical replacement in acceptance record; version label alone does not preserve earlier history. EN exclusion still open at freeze. |
| xG retirement |Decision5, “All steps now”; one exact registry row|Registry backup and aggregate counts retained; three reader checks claimed. Selector is fail-closed. New in-house xG absent, not silently replaced by an approved v2 model. |
| Composites/rankings |Dry runs, then “Publish now” / “Write now”|764 composites and50,320 ranking upserts claimed; distinct approvals recorded. Independent distribution/cohort checks not repeated. |
| team_unit_toi |“Rebuild now”; new snapshot, batches|299 games/39,506 rows,13 partial games claimed. Partial coverage must stay labelled/excluded by the reader; F3's complete-game gate inspected. |
|11-13 pipeline|Existing scheduled execution,11:01 read check|All11 stages complete by10:46, stage2 at10:07:53 claimed. Stall fix's late-WGO-total skip exists and its regression is targeted. This is a plausible failure mechanism and mitigation, not proof against all possible invocation deaths; durable running holds intentionally still require reconciliation. |
|NST/WiGO exceptions|Read-check authorization recorded|Mahura2 dates and2 historic WiGO identity rejects remain. A failure status can coexist with partial successful writes; no blanket “all fresh” assertion justified. No provider repair performed. |
|Trend bands|“Later, paced”;769 players,10/call,60s gaps|77 calls/666,376 bands/max9.5s claimed. Runner includes I/O/lock/latency guards and stops; no independent saved row or calibration check. |
|144–146|“Yes, after trend bands”; singly before merge|Hashes, key/trigger/check design verified; claimed13:16 readbacks remain unverified. |
|#433|“Yes, watch via GitHub”; expected1 build+3 cancels|Exact candidate tree confirmed locally. GitHub status and five smoke claims do not independently establish Vercel alias or exact deployed env. |
|Post#433 game state, CTPI, SOS|“Run them after release”;4 calls, two≤31-date CTPI chunks|Retained runner inspected:32 NHL GETs for games +32 for SOS; no calls made by auditor. Claims:1,409 stored states;1,102 candidate CTPI rows/v1 count9,489;32 SOS rows/84 fixtures and v1 count15,680. Counts alone do not prove all old values unchanged. |

### Incident and recovery conclusions

The transaction in `persist_nhl_api_gamecenter_normalized_v2` writes roster/events/shifts/status together and checks fingerprints/expected counts. It supports **no half-applied normalized game within one successful RPC**. It cannot prove every request used that RPC, all raw heads remained aligned after separate capture, or every summary was rebuilt from the final head. The changed-head TSV covers257 distinct games; it is correctly a change list, not sufficient as a full completion ledger.

Both DB incidents are consistent with sustained I/O/write pressure; checkpoint timing is correlation, not a demonstrated cause. Later stop rules and sequential pacing are better. Review claims should retain uncertainty about host resource causes and the impact of other approved concurrent work. No extra retry/rebuild is authorized by this audit.

## 5. Migration audit

All rows below have matching source/authority hashes at the pin. `applied` is **the authority's claim**, not a newly verified deployment state. Full values are retained in `migration-hashes.tsv`.

| Row | Definition / proof assessment |
|---|---|
|88|Physical totals RPC; known cutoff gap intentionally accepted before successor137.|
|101|Reserve table, RLS/public SELECT and separate flag rollout. No evidence here that output population is complete.|
|123|WGO team/date index; manual CONCURRENTLY path is explicitly documented, not byte-identical execution of the plain migration body.|
|124|Observed-at indexes; catalog validity/readiness readback required.|
|125|NST regular-season counts/complete support; `nst_seasonlong_l4a_rollback.sql` referenced.|
|126|Nullable rates/shares and OZ/(OZ+DZ); combined/MV zero-fill remains separately deferred.|
|127|Game-score season scope; RPC attributes/grants preservation needs catalog readback.|
|128|Skater average regular-season filter.|
|129|Season-keyed nhl_team_data; changed shape released with tolerant readers. Rollback drops/recreates view with grants.|
|130|Level team outcome becomes null; remaining consumers cannot infer a win from absence.|
|131|Zero-denominator goalie weekly metrics null. Retained production sample had no zero-SA week, so that readback is a control, not defect proof.|
|132|Lineup slots and PP assigned/dressed measures; new columns null until nightly rewrite. No-PP-unit players still lack stored0% rows.|
|133|Interim traded-player percent_games fail-closed definition, superseded by143.|
|134|Nullable skater placeholders; required before new writer. Unadapted consumers/Python EV_TOI remain a declared risk.|
|135|NST units/aggregate GSAA and complete support; playoff appearances blanked regular-season NST coverage.|
|136|5v5 season views; required before radar adoption.|
|137|Physical-totals cutoff guard successor to88.|
|138|Forecast basis/universe columns; schema alone does not prove writers persist correct declared basis.|
|139|Expected-games nullability; rollback **refuses after any null exists**. Append-only history makes this a forward-fix scenario, not a generally available undo.|
|140|Additive VDP view; historical rows untouched, known-version SD alias only.|
|141|Regular-season-only successor to135; snapshot refresh separate. Source replacement addresses playoff blanking; production coverage not independently observed.|
|142|Nullable signed v2_skill; does not retrofit composite_skill_score semantics.|
|143|Team-by-date percent_games successor; absence of team match remains null.|
|144|CTPI row identity adds version; existing rows receive logical default1, old value columns not updated. INSERT/UPDATE v1 frozen. Components nullable. No DELETE/TRUNCATE protection promised. Rollback refuses once v2 exists.|
|145|New SOS table and INSERT/UPDATE freeze on old table; no existing values updated by migration. DELETE/TRUNCATE not intercepted. Rollback refuses if any v2 row exists.|
|146|Nullable states/observation time with consistent CHECKs; no default/data rewrite. Rollback drops state columns: revert readers first and recognize loss of newly captured state.|

The F1/F2/F4 disposable-PG tests check pre/post defects and unchanged controls; these are substantially stronger than mere source-string assertions. They also test refusal after new history exists. I inspected them but **did not execute them**. No catalog/source equivalence can be established solely from an authority sha256: it authenticates the repository file, not the hosted object's definition. File headers still saying “NOT APPLIED” are stale deployment prose, not contradictory executable SQL.

## 6. Approval-dependent reads that would resolve specific gaps

**Proposed only; none executed, none authorized by this report.** Every batch starts in a read-only transaction with a short timeout and this guard; stop if active>5 or longest>10s. Read only the requested fields, no raw jsonb exports.

```sql
BEGIN READ ONLY;
SET LOCAL statement_timeout = '3s';
SET LOCAL lock_timeout = '1s';
SELECT count(*) FILTER (WHERE state='active' AND pid<>pg_backend_pid()) AS active,
       coalesce(max(extract(epoch FROM now()-query_start))
         FILTER (WHERE state='active' AND pid<>pg_backend_pid()),0) AS longest_s
FROM pg_stat_activity;
-- Stop/ROLLBACK if active > 5 or longest_s > 10.
```

1. **Migration existence (one metadata batch):**

```sql
SELECT version, name FROM supabase_migrations.schema_migrations
WHERE version IN ('20261027090000','20261109210000','20261109213000',
 '20261111180000','20261111180100','20261111180200','20261111180300',
 '20261111180400','20261111180500','20261111180600','20261111180700',
 '20261111180800','20261111180900','20261111181000','20261111181100',
 '20261112090000','20261112100000','20261112110000','20261112120000',
 '20261112130000','20261113090000','20261113090100','20261113160000',
 '20261113170000','20261113180000') ORDER BY version;
SELECT tgrelid::regclass, tgname, pg_get_triggerdef(oid)
FROM pg_trigger WHERE tgrelid IN ('public.team_ctpi_daily'::regclass,
 'public.sos_standings'::regclass) AND NOT tgisinternal;
SELECT oid::regprocedure, md5(prosrc), proconfig, prosecdef
FROM pg_proc WHERE oid IN ('fhfh_internal.reject_ctpi_v1_write()'::regprocedure,
 'fhfh_internal.reject_sos_v1_write()'::regprocedure);
SELECT indexrelid::regclass, indisvalid, indisready FROM pg_index
WHERE indexrelid IN ('public.idx_wgo_skater_stats_team_date'::regclass,
 'public.line_source_snapshots_observed_at_idx'::regclass,
 'public.lines_ccc_observed_at_idx'::regclass);
ROLLBACK;
```

For remaining function/view definitions, approve the exact object list from each migration's READBACK individually; compare catalog hashes to the recorded pre/post hashes. Do not select migration `statements` blindly.

2. **Recovery sample (11 exact OT games, one batch):**

```sql
SELECT game_id,status,strength_version,pbp_raw_payload_id,shift_raw_payload_id,
 expected_roster_rows,observed_roster_rows,expected_event_rows,observed_event_rows,
 expected_shift_rows,observed_shift_rows,normalization_fingerprint,completed_at
FROM public.nhl_api_game_normalization_status
WHERE game_id IN (2026020159,2026020161,2026020163,2026020172,2026020173,
 2026020174,2026020177,2026020187,2026020188,2026020192,2026020197)
ORDER BY game_id;
ROLLBACK;
```

This verifies only the sample and still needs head IDs compared to the retained manifest, plus indexed count checks on exact games. To certify all298, first obtain the original298-ID completion manifest and approve batches of≤20 exact IDs with source-head/status/summary-version scalar checks. No broad join or full payload scan is proposed. FormulaRevision alone is insufficient for lineage.

3. **Cron state and recent bounded execution times:**

```sql
SELECT jobid,jobname,schedule,active FROM cron.job WHERE jobid IN (14,305,327);
SELECT jobid,status,start_time,end_time FROM cron.job_run_details
WHERE jobid=305 ORDER BY runid DESC LIMIT 3;
ROLLBACK;
```

Compare those times with three retained pipeline stage receipts. This can test actual overlap; the static inventory only tests schedule minutes. Do not select cron commands, which may contain credentials.

4. **xG retirement (one exact registry row):**

```sql
SELECT model_version,feature_version,prediction_type,approval_status,
 model_approved,is_active,is_champion
FROM public.nhl_xg_model_registry
WHERE model_version='logistic_l2-s20252026-p1-st1-f1-cfg9bac2706'
 AND prediction_type='shot_goal';
ROLLBACK;
```

5. **Deployment/authorization evidence:** no SQL query proves either. Obtain the original TJ approval messages and already-retained deployment metadata for the exact SHA/project/environment/alias. A new deployment is unnecessary. Before/after CTPI/SOS row counts cannot prove byte equality; use retained pre-action hashes/exports if they exist. If they do not, report historical-value preservation as unprovable retrospectively from counts alone.

## 7. Release/rebuild blockers and next step

- **Before claiming full P0 closure or releasing affected RSO/goalie changes:** resolve AF-01 with per-candidate output tests. Preserve the partial classifications for #16/#17/#27/W3-P0-1.
- **Before another FORGE output rebuild intended to certify these fixes:** fix AF-02 and AF-03; make AF-05's legacy/new-head admission explicit. An output rebuild cannot repair those source defects.
- **Before activating markets:** close AF-04 across the goalie reader as well as market flags. **Before calling #21 validated:** complete AF-06's held-out final-output study or record a specific owner-sanctioned interim exception.
- **Before certifying shared strength/finality:** close AF-07/08 with consumer-level fixtures. Do not represent 2025-26 formulaRevision2 partitions as strength-v2 data.
- **Keep existing qualifications:** CTPI v2 candidate output unserved pending approval; no in-house xG model available after retirement; PP share unqualified; trend bands descriptive, not proven predictive; legacy route use unknown; one NST player/two dates and two WiGO identities unresolved.
- **Operational:** no further bulk recovery needed merely for audit. Before an actually necessary approved run, use exact scope and completion receipts, serial writes and I/O/latency stops; do not infer safety from HTTP200 or active-query count alone.

**Concrete proposed next step for Scout:** vet AF-01–AF-04 against the pinned files and saved offline probes first; assign bounded successor fixes and one final-output regression per affected reader. Then continue the independent audit against this same pin for the explicitly unverified P0 rows and lower-priority findings. Reconcile production claims using retained primary receipts before asking TJ for the smallest missing read batches. Today's unreleased implementations belong in the later addendum and cannot close this frozen audit by assertion.

Deliverables: this report, `offline-probes.cjs`, `offline-probes.json`, `migration-hashes.tsv`, `sql-proof-inventory.txt`, and the exact frozen export in this directory. Remaining blockers are source findings, incomplete exhaustive audit coverage and unverified production/approval evidence; no tool permission denial occurred.
