# Read-first extraction: lane records

Prepared 2026-11-14 by the bounded `readfirst_lanes` worker for Chef. This is a **records extraction, not an application audit or acceptance verdict**. All paths below are relative to `tasks/artifacts/calculation-inventory-2026-11-10/master/` unless prefixed with a repository path. Line numbers refer to the hash-pinned working-copy files in the manifest at the end.

## Coverage and evidence boundary

- Read the full governing `ASTRA-FULL-AUDIT-PROMPT-20261114.md` first, then repository `AGENTS.md` and `mise-en-place.md`, then the full `FIX-LANES.md` and **every one of 28 `fix-lanes/*.md` files**: 25 L-lane briefs, `_COMMON`, `FOLLOWUP-LANES`, and `CODEX-DEV`. No assigned section remains unread.
- No application source, test implementation, production receipt, database object, remote service, or live page was inspected by this worker. No tests were run. A test listed below is a **required test scenario in a record**, unless explicitly described as a historical claimed result. None is independently passing evidence.
- Baseline checkout: `/Users/tim/Code/fhfhockey.com`, `octoberBranch`; observed HEAD `6d77ede6998314d1700562ab598f38fe182323c9`. Historical target in governing prompt is `89da739cb`. This worker does not resolve that scope-pin difference or mark any scope file audited.
- Existing unrelated dirty/untracked state was preserved. Only this artifact and `tasks/diaries/2026-11-14-codex-astra-readfirst-lanes.md` were written. Worker runtime was verified from its current local rollout turn context as `gpt-6-astra`, effort `high` (rollout `01a1db71-4971-7273-9a30-c95f2fd125dc`). No recursive delegation.
- The briefs' headings **“Done” are acceptance criteria, not completion reports**. The index is an allocation and sequencing document. Absence of a closure report here means **status unestablished by these records**, not proof that a finding remains unfixed today. Other workers/Chef must reconcile the debrief, decisions, prior Astra verdicts, receipts and target source.

## Binding hierarchy and shared contracts

`_COMMON.md:3,7–12` says the full owner decisions win conflicts; sKO/VuDu intent is binding; consolidations supply corrected wording over raw audits. Those external documents were not read by this worker. This extraction therefore preserves the decision mappings stated in the briefs without independently interpreting all 152 decisions.

| Contract | Record pointers | Required interpretation / consumers |
|---|---|---|
| Reader proof and meaningful regression | `_COMMON.md:28–33,45–46` | Fix every reader; test served output; frozen fixtures must distinguish old/wrong results and fail before the change. Model changes need held-out checks. A lane report is a claim subject to Chef review. |
| Unknown, units, aggregation | `_COMMON.md:32`; L1–L18 details below | Explicit adapters; no missing-to-zero coercion; matched numerator/denominator sets; each quantity pooled by its own algebra. Issued evidence stays frozen; repair is a versioned successor. |
| Strength and score | `L1.md:13–18,25,28–29`; `L2.md:46–50` | Away-first strings oriented through shared helpers. PP/PK derives from penalty advantage; 4v4/3v3 or 6v5 without advantage is ES. Empty net overlaps strength; EN means opponent net empty. Event score is pre-event; interval score post-event; one-goal leads included, shootout excluded, unknown score null. |
| House danger definitions | `L1.md:16`; `L2.md:49–50`; `L4b.md:47–48` | Without archived NST definitions, use `PARITY_CHANCE_DEFINITIONS`: FHFH HD ≤20 ft/≤35°, SC ≤40 ft/≤50°, with house labels for HD/MD/LD metrics. No six-game tuning or silent NST equivalence. |
| GSAA, QS, goalie credits | `L2.md:12,18`; `L3.md:16–20`; `L5.md:12,20,54`; `L9b.md:13–25` | Aggregate GSAA = SA×(1−league SV%)−GA; no summed game GSAA or fixed .900. QS uses one Vollman definition, credited starters only; decisions 40/112. Start, appearance, relief, team result and credited goalie result remain distinct. |
| Percentile / rank / score | `L4b.md:24,33,45`; `L5.md:19,26,49`; `L17.md:18`; `L18.md:35` | Decision 90 supersedes exclusive/strictly-lower percentiles: tied values share mid-rank everywhere. Competition ranks remain separate; 0–100 scores are not percentiles; stable order independent of input or display sort. |
| PP share, historical contract | `L8.md:15,24,27,33,41–49`; `L4b.md:50–51`; `L6.md:20` | Shift intersection with qualified penalty-clock intervals divided by same-game team PP clock; pool same dressed games, retain measured zeros, unknown makes unavailable or labelled subset. Never cap >100%. Nov 11 contract explicitly says `PP_CLOCK_QUALIFIED=false`. FORGE PP time is a model input. Decision 86's assignment-share and dressed-share are distinct measures. **Decision 152's later contract is not specified in these lane files.** |
| Rolling counts and availability | `L6.md:15–24`; `L5.md:46–47`; `L9a.md:53–54` | Keep rate aliases until consumers migrate; `windowCountSupport` supplies counts, seconds, game IDs. xSH%=ixG/iFF×100. Availability is historical team of record by date, potentially null. Calendar L7/L14/L30 uses days ending today. |
| Goalie candidate contract | `L9a.md:67–69`; `L10.md:53–54`; `L11.md:46–47`; `L22.md:42–43` | `forge_goalie_candidates_v1` through `readGoalieCandidatesContract`, old/missing rows fail closed. Candidate identity, conditional line, P(start), unconditional product with labelled zero-relief assumption; credited win distinct from team win. No reconstructed partner probability or hidden renormalization. |
| PK totals | `L9a.md:11–12,35–36`; `L10.md:60–61`; `L12.md:55–56` | Exclusive ES/PP/PK/extra-attacker treatment and one physical rate application. Reader sums PK only when known; unknown PK remains unknown. These are explicit reader tickets, not closure evidence. |
| Stat registry | `L13.md:25,31,34`; `L10.md:56–58`; `L11.md:49–50`; `L18.md:47–48` | `statsMasterList.ts` is shared role/direction/counting-vs-ratio authority (decision 55); OTL direction league-specific; PIM not exempt from sensitivity as a ratio. SV%/GAA valued by effect on roster totals. |
| Forecast basis and calendar | `L10.md:14–19,32,41`; `L11.md:35,52–53` | Unconditional forecasts use full eligible universe and identity-complete final receipts; conditional basis requires played players. Unresolved is unknown. Decision 127 is one versioned switch to NHL schedule dates (`forecast-calendar-v2`), shared across ledger/bridge/planner. |
| Missing projection and participation | `L9c.md:11–17`; `L11.md:11–23` | Every eligible player gets if-plays line; confirmed-out expected contribution 0, uncertain availability separate and qualified. Unknown ≠ confirmed-out. Coverage and recommendation gates per player; incomplete totals count missing players. |
| xG admission | `L14.md:14–36`; `L2.md:52–54`; `L9a.md:60–62`; `L16.md:33–35` | Shared `fetchActiveXgModel` pins model AND feature version; null means unavailable. NST labelled headline; bucket heuristic retired. Exact calibrated artifact must qualify on untouched chronological holdout, proper-score base-rate comparison and lineage; EN split out. |
| Predictions and odds | `L16.md:12–19`; `L22.md:11–28`; `L12.md:17,52–53` | No qualified model → explicit unavailable; cron skipped, not success. Displayed probability determines pick; 50% tie; rounded complementary sides. Same-book odds, declared format, shared 50/50 OT approximation until fitted alternative qualifies. |
| sKO | `L20.md:3,11–18`; `L21.md:11–19,28` | Keep and rename legacy definitions without rewriting history. Signed gap with units only; gap/support/opportunity separate. Source clock, permission, expiry, coverage and exact window IDs survive comparison. No VuDu completion or composite without owner design/held-out evidence. |

Historic workflow restrictions do not authorize actions now. The governing audit prompt requires read-only source audit and exact-action TJ approval for production reads/actions; no lane instructions were executed as operational commands.

## Lane-by-lane mapping

Each entry separates the binding finding/decision scope, required readers/tests, and the record's status or remaining work. All implementation claims remain unverified.

### L1 — event state, parity, ingestion (`L1.md:5–42`)

- Findings: W2-2 D1/W2-3 D1→W2-P0-2 oriented strength; W1 #4 score ordering; #6 MIN4/MIS10/PS classification (penalty-shot infraction excluded from player penalty totals, 1010 not EN); #7 archived definition or house relabel; PR-U3/A1 distance sums/measured counts; W2-7 D1 nullable placeholders/own-net-empty/shootouts; expiry, PDO adapter, miss reasons. Decisions 7–9,11,13,24,59,70 plus answered 83/84. `:13–25,36`.
- Reader obligation: export manpower/score helpers for L2/L8/L9a; parity distance components. Tests: oriented 1560/1460/0551, 4v4/3v3, expiry/double minors/coincidentals/OT, simultaneous goal boundary, absent score, own-net-empty/shootout, null placeholder, reconciled exclusive TOI (`:27–29`).
- Status: no completion result in this brief. Later L2 tickets cite `cb28ffc58` helpers and `72e78b3d1` house labels. History repair and bounded L1+L2 rebuild remain separate approved steps in the brief (`:31–33`); not proof they are still pending now.

### L2 — underlying landing and summaries (`L2.md:8–57`)

- P0s W2-2 through -7 plus W1 #2/#4/#5: oriented strength; duplicated MD/LD GA (not uniform 2×); aggregate/danger-specific GSAA; split keys; score-state TOI incl. fallback; pooled season-bounded PP/PK ranks; nulls-last pre-pagination; heuristic-xG hidden/default sort moved. P1s D10–D19/PR-U1–5 and W2-3 D5/D7–17/A2/A4/DR1/DR3 cover matched metrics/ranges, OZS excluding NZ, overlay provenance, Last N, finality, OT/OTL/shootout denominator, exposure cutoff, chart coverage and nullable accumulation. W3-1 D7/C1 pins explorer identity (`:11–26`).
- Decisions 6/7/9–12/16/20/59/70 and 91–96: current overlay only; no split records; labelled record-only SOS; player/team Last N by actual played/date; unknown position (`:28–38`). Readers are all player/goalie/team landing/detail/chart APIs and xG Lab. Required API fixtures cover oriented splits, danger GA/GAA/GSAA together, boundaries, pooled/null early-season PP, pagination and all-null column (`:31–32`).
- Status/claims: helpers supplied in `cb28ffc58`, house definitions `72e78b3d1`; selector adoption ticket says L14 “done” (`:46–54`) but does not prove L2 adoption. Stored old summaries and reader payload-version regression expressly require served evidence (`:29`). Bounded rebuild plan is a deliverable (`:34–35`). Split ownership detailed at `:57`.

### L3 — variance, roster matrix, TOI (`L3.md:11–47`)

- W2-P0-8 pooled iCF/60, correct label, IPP/ixG withheld until verified (decision 73); A3 matched TOI; D6 aggregate GSAA; D7 GAA seconds/minutes and LD-save source; D8 starter-only weekly half-tie grading; D9 singleton SD/null conversion with **double-count FP claim withdrawn**; PR-U1/2/4 range/pagination/QS unknown; A5 integer-minute parser; W3-3 D4 biography helper; remove credential log without printing secrets (`:14–26`). Decisions 97/98 settle week grading/floors (`:35`).
- Tests at rendered builder: unequal or missing TOI, all-tied week, singleton tier, 600-second relief GAA, `"20"` minutes (`:28–29`). No production action expected; SQL belongs elsewhere (`:31–32`).
- Status: no closure report. Migration125/126/131 null-reader tickets are dated unapplied (`:43–44`); later L7 ticket claims parser `"20"` works and unknown returns NaN, requiring caller null handling. API Teams grant and L7 boundary at `:46–47`.

### L4a — NST SQL and ingest (`L4a.md:11–42`)

- W2-P0-1/F1: type-2 scope plus rejection/quarantine of GP>1 aggregate pretending to be one game; D3 Game Score season/date identity; D4/PR-SQL-2/F3 exact team season/as-of; PR-SQL-1 matched unified components; D9 OZS zero denominator null; D8/D10–14/D16 game filters, goalie-credit loss, percent_games, inventory-only deletion; D6 house all-situation Game Score; D7 decision86 dual PP assignment/dressed shares; dormant W3-7 D9/A5 streak default deferred. D15 Human Mock ADP and M-SUS-001 weight argument explicitly withdrawn (`:14–24`). Decisions 85–87 settle Game Score/dual shares/trigger cleanup.
- Required SQL/parser tests: playoff exclusion and GP2 aggregate that looks regular-season; exact-season permutations, lag vs old match, missing current season and historical cutoff. Readers L4b/L3/L9a/L11/L7 (`:29–30`). Local migration proof plus apply/readback/rollback plan, never apply by lane (`:32–42`).
- Status: brief is a plan, not proof of migrations applied. Sole migration author in original index. New files/authority pending + count-test update, never rewrite applied migrations (`:5–8`). D10 unified totals later explicitly deferred by L7 ticket `L7.md:46`. Physical migration guard condition differs from later L9a update; see reconciliation list.

### L4b — WiGO and radar (`L4b.md:11–51`)

- W1 #8 same 5v5 player/cohort/floor/season, N+1 rank, iHDCF label. W3-1 D3 separate F/D, minutes-based visible floors; A3 per-stat finite cohorts/partial coverage; D4 true 32-team composite percentile; D5 canonical game ledger; A1/A2 null-safe seasonal writer and no resurrected null rate; D9/11/12 one-side/IPP/GP/PP pooling/DIFF; SQL D9 OZS reader. Decisions 9/15/16/69/71/74/81/85/90 (`:14–24,33,45`).
- Required tests: writer→served null, missing stat/side/empty cohort, true driver percentile, playoff/mislabelled shared calendar; all comparison/chart/radar surfaces (`:26–27`).
- Status: no closure result. Explicit migration125/126/127/133 reader tickets (`:41–43`); new percentile-rank route null handling; house labels and Nov11 unqualified PP clock contract (`:47–51`). Seasonal rebuild separately approved after views (`:29–30`).

### L5 — rankings/splits (`L5.md:9–54`)

- P0-9 units plus aggregate GSAA (not transplant factor fix to impact ratings); P0-10 one qualified xG source per column; P0-11 counts vs /60 with L6 support. W3-6 N1 rate alias fallback without breaking real-count fallback; D3 luck matched-basis neutral100/unknown (**not inverted**); D5 Fenwick; D6/D8/A2 actual window membership; D7/A3 score/rank/percentile, no MCM recenter; D9 shared QS/RBS/Steal; D10 season/as-of; D12 rollover; A1 matched xG; W2-6 distinct players/unioned shifts/finality; decision90 mid-rank (`:12–26`).
- Decisions 98/102–106: visible floors, refuse missing-input composites, current-season default, one strength/no Value Signal, verified most-used line, honest RBS/FHFH names (`:37–38`). Tests include −.39/48.05min→−.49/60, partial xG, identical season/20-game counts, neutral luck, stable rank under reversal, cross-season membership (`:31–32`).
- Status: no closure result; L6 support/availability ticket at `:46–47`; decision112 QS addition at `:54`. Snapshot/composite regeneration separately approved (`:34–35`).

### L6 — rolling/trends (`L6.md:12–44`)

- W1 #9 adapter+fallback jointly (playoff TOI seconds, not merely multiplier); #11 metric scales/calendar windows; #10/P0-11 explicit counts+IDs while preserving aliases. Fenwick xS% and legitimate ixG/SOG>1; matched support; qualified PP denominator including zero-PP dressed games; team-of-record availability; equal raw mid-ranks; update defect-pinning TOI20 test; hot/cold exclusivity and warning copy; dormant combineSKO signs (`:15–26`). Decisions 16–18/23/59/61/71/75/80.
- Required regular/playoff fallback 9.77 vs .163, gap-day window, sum-count identity for identical membership, zero-PP game tests; dashboard/trends/L5/FORGE/social readers (`:31–32`).
- Status: no closure; record says **58 tests passed despite defects**, not evidence of correction (`:29`). Held `nst_persistence_unconfirmed` rolling/FORGE writes must reconcile before separately approved bounded rebuild (`:29,34–35`). Q21 deferred to L5 answer.

### L7 — sustainability/bands/charts (`L7.md:10–54`)

- W1 #23 discounted-minute 60× bug; #24 own-band comparison/prior consistency; #25 pooled career components (old stored numer/denom zero-filled). A1 choose N before dropping zero trials; A2/A3/F2 unknown score/count; A4–6 valid IPP, pre-window priors/cutoffs and no fabricated variance certainty; N2 same 5v5 exposure **no migration**; N3 observed vs shrunk PP; N4 invalid IPP; N5 exact discrete forecast bands stays unserved; N6 labels; PDO/PK direction/season start/final-manifest checks (`:13–25`). Decisions 17/26/32–37/61/68.
- Tests at API: corrupt z, suffix invariance, all-missing, constant 5v5 rate, IPP invalid/valid/both-null; caller parser tests for `20`, missing strings, unequal seasons (`:30–31,48–51`). Four FORGE trend inputs only; hits/blocks excluded. Activating corrected bands changes currently inert adjustment, requires L9a validation (`:28,42–43`).
- Status: no closure. D13 quintile key/schema ticket and D10 unified totals deferred (`:45–46`). Trend-band history rebuild separate from priors/baselines (`:33–34`).

### L9a — FORGE skaters/context/markets (`L9a.md:8–72`)

- W1 #18 exclusive PK/net-state totals; #19 once-only physical exposure; #21 independently estimated shrunk opponent-goalie feature with held-out fit (not circular FORGE SV%). A1/N1 final bootstrap/scenario reconciliation; A2 known zero exposure; D5 weight-scale/shrink refit; D6/D8 unit copies; exact season/prior cutoff; shared classifier; null ranks; null actuals/historical PP/over-allocation; N2–4 assist variance/dispersion/TOI; D5 mixture quantiles; D7 infeasible allocator; D2 game-scoped scratch/RETURN; dormant odds/devig/confidence; inert trend reader; goalie context/residual home/assist allocation; research scoring and decision27 held-out venue/opponent backlog (`:11–30`). Decisions 10/16/24–31/59/65.
- Required final serialized payload tests: PK totals, physical rates once, zero-shot exposure response, null rank, 3xGA/3600 seconds, spread−.70 (`:35–36`). Model claims need held-out evidence, not these arithmetic fixtures.
- Status: no acceptance report. L9c says L9a is closed, an external closure claim. Decision119 says physical migration applied Nov12 **as-is**, successor cutoff guard still requested (`:41–42`). Exact-season/null rolling/placeholder/xG tickets at `:50–62`; preserve L9b test pin; horizon-scalar metadata still ticketed (`:64–69`). Markets split ownership at `:72`. Reconcile held writes and approve FORGE rerun separately.

### L9b — goalies/start chart (`L9b.md:10–44`)

- Credited starter label root: official games_started1 exactly once, no max-TOI guess. #16 fix outcomes→timestamps→pregame cutoffs→refit; complete candidate vector1, incomplete unknown mass; keep 200-game/30-slate validation gates. #17 determine effective serving branch before fixing L10 share/B2B; no lost-mass redistribution. #20 candidate-specific if-starts/P(start)/unconditional with relief or explicit zero-relief; own credited result. D24/N6 per-game probability, .900 baseline removal, N1 unknown rest, PR5 per-start identity, immutable issuance; accuracy job proposal explicitly Codex-blocked (`:13–25`). Decisions 10/25/28/40/60/63/66.
- Payload tests: starter600s vs reliever3000s, contradictory labels unknown, three candidates, distinct IDs, relief basis, null rest (`:27–28`). Required completion includes refit **plan**, not completed refit (`:39–40`).
- Status: no closure evidence in brief; index `FIX-LANES.md:61` claims closed/handed to Codex. Refit promotion and rerun remain separately gated. Accuracy portion becomes CODEX-DEV item2; null Python inputs ticket persists (`:42–44`).

### L9c — coverage (`L9c.md:3–23`)

- W1 #27 root and decision132: trace missing 101/673 eligible lines reported under held runs; every eligible player including injured/long absence receives if-plays line. Time-away uncertainty decay fitted on held-out returns, otherwise labelled unvalidated; no fixed declining rate. Confirmed-out expected0, uncertain qualified participation, missing unknown. Final payload coverage report eligible/projected/unknown/reasons; reserve proposal to Codex (`:11–17`).
- Status: calls L9a closed at `:6`; otherwise acceptance-only. Tests/evidence end-to-end eligible universe→line→availability→served. Rerun/rebuild/migration need approval after held-write reconciliation (`:19–23`).

### L10 — ledger/planning/season settlement (`L10.md:11–70`)

- Decision41 declared basis; W2-8 D1 identity-complete stored official final receipts, never count-only or unconditional dressed filter; W2-7 D6 proper naive windows/unknown own win; rounded-vector resolver tolerance only if proven; D3 unknown candidate coverage; D5/6/8 permissions/calendar/scratches; PIM units. BC A3 null interval guard; W3-5 F7/PR4 proper aggregated score and version bump; PR5 issuance manifest allocation; F4 joint quantiles; F6 nullable round trip; F8/9 labels; F10 frozen successor; restOfSeason NaN/missing; baseline basis (`:14–29`). Decisions 38/39/41/46/63/65/78/79/122/123/126/127.
- Tests: wrong identity set, justified unconditional zero, Poisson(.2) expected loss, p1.2 rejected, null/empty/reversed bounds, actuals allocation, TAKEAWAYS roundtrip (`:34–35`).
- Status: no closure. Candidate, PIM, category sort, **unknown PK** and L15 nullable/faceoffs-lost tickets (`:49–67`). Historical resettlement, market env-off and scoreboard logs separately gated (`:37–38`). Split halfA/B and default-off basis/universe DDL at `:70`.

### L11 — RSO (`L11.md:8–53`)

- #26 qualified projections only; no unvalidated form blend/double participation. Comparator transitivity. #27 per-player gate across planner/BestFit/streaming/DROP, true reserves, incomplete totals, unknown drops review. #28 credited W/L/OTL/no-decision conservation; Yahoo unresolved mapping. Re-aim SA=SV+GA; unresolved provider mass; joint reserve selection; tilt/date issues; unrounded probabilities/no cap; exact-season prior; live bench/DP/B2B issues; category ratio tradeoff; Yahoo historical points/credits blocked on Codex (`:11–23`). Decisions 2/3/46–52/55/57/63/67/127/128.
- Required planner outputs: +2 vs +4, unknown drop, comparator permutation cycle, joint reserves, .33337/.33337/.33326, re-aim conservation (`:28–29`).
- Status: no closure report. Reserve migration separate; season/candidate/registry tickets and exact calendar-switch files at `:43–53`. Yahoo proposal becomes CODEX item7.

### L12 — team ratings/CTPI/SOS/Grid/Top Adds (`L12.md:12–62`)

- #12 fixed all32 baseline, post-normalization shrink, sample SD; #13 pooled PP/PK/null/ties; #14 odds and B2B/matchup nudge withheld, cron390 inventory only; #15 typed missingness all TopAdds callers/ownership; #22 honest 100-centred history/change; #29 idle0 only known schedule/exclude sentinel from scaling. CTPI pooled weighted components/version migration; SOS finality; consistent power definition/EN; measured off-night, WeekScore non-lexicographic, date range; invalid Poisson lambdas; pickup missingness/GP double count/team-of-record (`:15–26`). Decisions 1/7/16/19–21/45/53/56/58/64/118.
- Tests: slate-mask invariant, GP1 vs10 shrink, null PP, unavailable odds, −100 excluded, incomplete missing-head row; affected readers listed `:31–32`.
- Status: no closure report; says CTPI/SOS behind gates in done criteria (`:44`). **Follow-up F1/F2 explicitly identify missing production wiring**, so helper correctness cannot close writer obligations. PK totals ticket `:55–56`; null-tier grant `:59`; historic Codex UI holds/handoff `:49–50,61–62`. Recompute and CTPI migration separately approved.

### L13 — draft/category/projections (`L13.md:12–49`)

- #30 league-aware roster-impact goalie ratios/no second shrink/missing exposure unknown; R1 missing category unknown; P0-14 qualified league-aware VORP base, VONA separate until held-out replay; D3 frozen replacement vs live availability; D4 global slot assignment; D5 unstable need scale; D6 ratio-aware standings/winner; M-DRF-010 like-for-like comparison; dormant source accuracy before activation; D7–14 community/missing/default/mock; shared direction/role registry; PIM exemption; W3-1 D2 finite competition ranks/no mutation; D10 non-overlapping tiers including negatives (`:15–28`). Decisions 54/55/57/62/65/74/76/77/113–115.
- Tests: 100/99/0 base order, held VORP stable across draft, exhaustive two-slot, one-shot goalie, [null,−5] unknown (`:33–34`). `Math.abs` weight claim disproven; UTIL already any skater; Fable473-player experiment unreproducible (`:31`).
- Status: no closure report; other briefs cite registry commit `456ba9e61`, adoption still a reader obligation. Mock migration only if separately released. ProjectionSourceAnalysis grant at `:49`.

### L14 — xG (`L14.md:11–42`)

- #1 active leaky champion must be demoted only by approved action; shared registry pin/per-consumer plan; #2 retire heuristic model; #3 shot-map left/right. Tie-pooled isotonic, compound event key, probability-space scorer, calibration/proper scores/convergence/pagination/exclusive credit, dressed-game coverage and feature/season isolation, strict applied-artifact gate, no EN xG/GSAx/xGA (`:14–24`). Decision88 holdout5% relative-SE minimum, exact applied artifact, proper base-rate score/calibration/subgroups/no leakage (`:35–36`).
- Tests: two models, known shot side, tie permutation, duplicate event IDs across games, constant.5/140rows/10goals rejected, version isolation, raw=no-flurry, EN excluded (`:29–30`). Leakage demonstrated by lineage/counterfactual, not AUC/Brier alone (`:27`).
- Status: “keeps serving until approved demotion” is historical `:14`, **superseded by CODEX-DEV:41 retirement claim**. Neither establishes current source/production state. No recorded test results here. Model training/admission is outside simple arithmetic closure; demotion/registry/aggregate actions separate.

### L15 — TS/Python season models (`L15.md:3–46`)

- F1 no pace/venue multiplier on goalie outcome heads until fitted coherent model; F2 explicit mean/variance parity incl. clipped aliases; F3 fallback m vs m²; F4 joint event quantiles; F5 preserve EV derive-or-use/clamp telemetry; F6 nullable contract first; F8/F9 population-prior and projected-ice-time labels. W2-7 proper-score experiment/version, de-shrink/exposure/B2B/roster GA/champion/null actual/faceoffs; A1/A2 unavailable history; W2-8 fixed82/Bernoulli variance/ratios/head reconciliation; BC credited starts/coverage/unknown/EN/DNP/correlation; decision66 exact versioned starter artifact (`:12–23`). Decisions 121–123 settle outcomes/population label/PPPK withheld.
- Tests: complementary .5 outcomes stay coherent under pace1.2, TS/Python moments not just means, golden vectors diff note, pytest each Python change (`:28–29`). Consumed lockbox means intervals uncalibrated; no in-place contract/checksum/receipt rewrites (`:26`).
- Status: brief opening says all dormant but decision66 row says **live? trace first** (`:3,23`); do not propagate blanket dormant status. L10 cites commit `12e55325d` nullable/ratio tickets, not independent proof. SQL `greatest` null→0 and faceoff nullable tickets `:43–46` require twins.

### L16 — homepage (`L16.md:8–35`)

- A1/D5 per-side complete strength buckets, model version, freshness; no partial sum or max-timestamp concealment; live official SOG overlay. D2 unavailable notice, displayed complementary pick/50 tie/accessible label. D1/D6 pulse bounded age/qualified model/single meaning, stale[]; decision109 hides model series until qualified (`:11–25`). Do not change CARD_RANK_POLICY/currentNhl/liveData.
- Required rendered tests missing bucket/stale side/version matrix, .504/.496 display tie, unavailable notice/stale pulse (`:18–19`). Status: no closure; selector ticket calls L14 done but homepage adoption still required (`:33–35`). No production step expected.

### L17 — player summary/leaders (`L17.md:10–33`)

- W3-P0-1: page merge must preserve matched NST counts/TOI and on-ice pairs; aggregate rates and shares by denominator, incomplete null; don't TOI-weight per-game statistics. Separate chart reducer must repool or disclose. Heatmap threshold score not percentile. D5 goalie qualifier printed from displayed season, unknown on failed standings, explicit cutoff ties. Decisions89/90 (`:13–18,27`).
- Required page merge→summary/chart fixtures: unequal two/six-game exposures (3 vs2 G/60,62.5 vs40% CF), missing/zero/trade, goalie tie5/fallback season (`:20–21`). Status: no closure result, no production action expected.

### L18 — social (`L18.md:8–48`)

- D2 credited W-L-OTL not GP−W; A1 complete-stat recent chain/no all-null cold/starts for QS; D4/A2 PvP count/TOI game intersection with honest coverage/export/alt text and configurable90%; streak pruning; measured off-night/idle/withheld odds (`:11–18`). Mid-rank decision90; L3 starter-only half-tie grade ticket; CreaseShift explicit finality/completeness before handoff; shared stat registry (`:35–48`).
- Tests chain:3-1-1, all-null unavailable not cold,10count/1TOI incomplete, point streak, finality sources/e2e fixtures (`:20–21,40–45`). Category Counts/disclosed formulas/TGV unchanged.
- Status: no closure results; index claims closed/handed crease files to Codex. No publish authority; studio rendering only (`:23–24`).

### L19 — legacy averages/CSV (`L19.md:3–31`)

- D3 60× rates, TOT/season denominator pooling, newest season, zero denominator null; A2 shares and versioned field scales; D11 exact identity not prefix. Unknown external use means severity conditional; decision124 bounded logs separately approved, fix units regardless (`:11–25`).
- Required unequal-team TOI rates/shares, scales and prefix collision fixtures (`:18–19`). Status: no closure. Routes reach NST: **do not invoke**. Python siblings review-only. No retirement/deletion requested.

### L20 — legacy sKO (`L20.md:3–33`)

- D1 define/rename weighted L10/L5 pace/horizon, null and game-type safe; corrected zeroSD1 and affine-invariance interpretation. D2 SD mislabeled CV, version/model/horizon filters and compatibility warning. D5 unknown/invalid IPP reason and missing-state investigation. D8/A4 classifier SD/PA:SA transform/mask/null fixes only if used; invalid proposed null-vs-omitted test rejected; mixed horizons (`:11–18`). Decision129 keep update-sko-stats, pause predictions-sko only as approved action until defined (`:26–27`).
- Tests affine invariance/bounds/zero history/SD naming and IPP row builder (`:20–21`). Status: no closure; fail-closed nulls,404 and issued history preserved; columns/crons/API gates/backfills separate actions (`:23–24`).

### L21 — Sko Element (`L21.md:3–34`)

- A1 target admission clock/permission/coverage/provenance; A2 exact identity-complete window before validation; A3 opportunity cannot treat fewer appearances as steady/knownAt; D3 signed forecast−recent gap units, no watch labels, three comparisons separate and covariance considered; D4/7/10 exposure/reference/null/version; VuDu matched-shot sign correct and guarded (`:11–19`). Decisions130/131 signed units/components separate.
- Tests future-issued/revoked/incomplete/observation-only, exact game IDs,10→5 appearances (`:21–22`). Status: no closure; dormant production404, no promotion planned; Codex comparison proposal becomes item9. VuDu and composite owner design remain out of lane.

### L22 — predictions/odds (`L22.md:8–46`)

- D1 decision42 unavailable and cron skipped; decision43 displayed pick/tie; simultaneous-slate backtest leakage; immutable publication-before-start cutoff incl. missing start; matched partial feature rows; same-book declared odds; lineup dropped; accountability paging and promoted identity; decision1 replacement benchmark only; decision44 chart stays unrendered; decision45 shared50/50 OT approximation. Calibration max-gap test explicitly invalid (`:11–25`).
- Tests cutoff-after-start, simultaneous/later outcome counterfactual, unknown partial rates, same book,50 tie, skipped receipt (`:27–28`). Status: no closure results. Shared OT and candidate contract tickets; nhl-predictions/oddsSourceIngestion grants, decisions116/117 named but not defined here (`:42–46`). Actual cron audit persistence becomes CODEX item5, so route-only skip test is not full-chain proof.

## Follow-up F1–F5 and Codex items

`FOLLOWUP-LANES-2026-11-13.md` contains **only F1–F5**. F6–F19 are not separate briefs in this directory. CODEX-DEV names some later file owners without full acceptance specifications. Root must obtain their other records; this worker has not classified those lanes audited.

| Lane | Required work and status claim | Tests / action gate / pointer |
|---|---|---|
| F1 | L12 v2 pooled helper is candidate/unapproved and only audit scripts call it; production CTPI writer still v1. Add versioned writer, version-selecting labelled readers, pending migration, preserve all v1 rows. | Writer/readers tests, migration authority pending, apply/backfill plan. `FOLLOWUP-LANES:20–25`. This is explicit evidence that L12 helper completion did not prove production wiring. |
| F2 | `computeDescriptiveSos` v2 has no non-test caller; old writer uses date≤today and NHL32club+standings calls. Route writer/readers through versioned contract without increasing provider usage; preserve v1. | Boundary test and bounded recompute plan. `:27–30`. No source verification or calls here. |
| F3 | 5v5 constant false; decision137 flip only after team_unit_toi rebuild queue8; update pinned test then local isolated visual check. | Ready commit+visual note required, no completed check reported. `:32–36`. |
| F4 | Date/start+8h heuristic called defective; design stored state, ingester+migration, consumer version contract; text permits **labelled fallback** when state unknown. | Pending migration+ingester/readers tests; migration→backfill→readers rollout. `:38–43`. Reconcile fallback with stricter governing rule19 before judging consumers. |
| F5 | Claims release433 issued1,102 v2 candidate rows Oct7–Nov13, v1 frozen migration144, approved-only readers serve no rows. Evaluate v1/v2 held-out nextN GD/game and points%; no production writes/provider calls. If at least as good, future approval successor date; never relabel candidates. Otherwise reasoned no-go. | Report plus verified commit or no-go; separately approve date/reissue. Game-prediction features pinned v1. `:45–63`. Later descriptive-beta behavior is outside this file's closure evidence. |

`CODEX-DEV-2026-11-13.md:3–21` is a historical final-day assignment, freeze18:30 UTC Nov13, regression-before-fix/typed checks, explicit mailbox receipts required. It contains **no item completion receipts**. Full proposals are in the coordination mailbox, not reproduced there.

| Item | Contract / affected file | Required unresolved boundary in this assignment |
|---|---|---|
| 1 | `update-goalie-projections-v2.ts`: W1#17 strict pregame `<`, rawL10 start_probability null or labelled, leagueSV baseline (`:26`). | Need own proposal, subsequent release439 evidence and actual valid GA/SA baseline source. |
| 2 | `run-projection-accuracy.ts`: credited starts/latest pregame/real30-day accumulation/TOI units/leagueSV/per-candidate scoring (`:27`). | Cannot infer completed from lane handoff; this brief supplies no receipt. |
| 3 | `goalie-stage.ts`: PK SA known added, null unknown (`:28`). | First check whether `4eab7347d` already fixed; this is a **candidate prior closure**, not confirmed. |
| 4 | StartChart skater availability: if-plays uncertain label, expected0 confirmed-out (`:29`). | CTPI portion excluded; only availability path. |
| 5 | `withCronJobAudit.ts`: skipped:true recorded non-success (`:30`). | Must verify wrapper status, not just forecast route skip return. |
| 6 | stats writer + completeness + transactional persistence: failed teamPP fetch null and goalie0/0 nullable (`:31`). | If NOT NULL column, write pending migration and report; no apply authorization. Later decision152 reader/writer behavior requires other records. |
| 7 | Yahoo rosterPlanning: historical team by date, unproven DNP null (`:32`). | Decision78 identity evidence, not assumed absence. |
| 8 | Yahoo liveDraft: sort_order vs shared direction registry (`:33`). | Decision55 reader mapping. |
| 9 | BLSH trade/market/components: forecastAdmission, signed-unit gap, separate gap/support/opportunity (`:34`). | Decisions130/131, preserve Sko admission contract. |

Later reserved filenames in `CODEX-DEV:36–38` identify F6 skater stage, F8 Lines CSS, F9 power ratings, F10 SOS surfaces, F11 penaltyClock MAT/15, F12 RSO bridge, F13 opponentGoalieQuality, F14 goalieOutcomes/market-queries/overtimeRule, F15 strength/derived penalty-shot files. They are ownership notices, **not full briefs or closed findings**.

Explicit outside-sprint backlog `CODEX-DEV:40–47`: xG v2 features/training/held-out approval packet; goalie starter refit and BC W1-6 D8/D13/D14 model changes; decision53 WeekScore held-out roster-scenario off-night study. Each needs its own plan and production/model-promotion authorization. Line41 claims no model active since cfg9bac2706 retirement Nov13; not live-verified here.

## Reconciliation points for Chef

These are **record inconsistencies or known historical transitions**, not new application findings. Resolve against owner decisions and later receipts; do not reopen an Astra-closed defect solely from a stale brief.

1. **NST pacing text is unsafe if read as a complete algorithm.** `_COMMON.md:20` allows ≤39-URL bursts with60s pauses/two bursts then5min while naming all four rolling limits. Repetition can violate100/15min or180/hour. Governing prompt requires ≥21s across callers/one NST job; that current rule wins. No provider calls performed.
2. **Finality fallback differs.** F4 `FOLLOWUP-LANES:42` allows labelled date/time fallback when state unknown, while governing §4/rule19 asks state-based finality and names remaining consumers. Check whether fallback is display-only or can admit unfinished rows to denominators. No behavior claim established here.
3. **Physical-totals sequence changed.** `FIX-LANES:80`/`L4a:33` say apply after cutoff guard. `L9a:42` records decision119 applied as-is on Nov12 and asks a successor guard. Treat as an owner-authorized sequence change only after confirming actual decision/receipt; do not report unapproved action from these two texts alone.
4. **Champion state changed.** `L14:14` says keeps serving pending approved demotion; `CODEX-DEV:41` says retired Nov13. Current no-active claim and all selector readers need later source/receipt checks. Likewise L4b Nov11 PP unqualified, L4a migration pending, and F3 flagfalse are historical, not current conclusions.
5. **Helper vs served closure is explicitly incomplete.** F1/F2 identify uncalled v2 helpers after L12 implementation. F5 describes approved-only CTPI unavailable state before later descriptive beta. Test/admission claims must follow actual production writer and current reader path, not helper tests alone.
6. **Blanket dormant label is not sufficient.** `L15:3` says all findings dormant while decision66 row `:23` explicitly asks to trace live reach. Preserve this uncertainty until issuer consumers are traced.
7. **Potential policy wording mismatch for percent_games.** `L4a:20` says current-team decision16; `L6:21`, L5/L9a tickets and L12 `:26,47` require historical team-of-record by date. Multi-teamNULL in migration133 is a transitional claim. Resolve decision16/latest migration143 rather than adopting either shorthand mechanically.
8. **Historical ownership inventory is not a current no-overlap proof.** Index `:7` reports zero overlap/no-empty patterns at creation, but later grants/splits/handoffs alter ownership and the governing release supersedes it. Do not use historical reserved paths as new edit authority. No ownership mailbox was modified.
9. **Path drift in follow-up references.** F1/F2 reference `web/lib/teamRatings/recentTeamFormV2*` and `strengthOfScheduleContract` while original L12 owns their `web/lib/trends/` paths. Confirm actual target source path during inventory; do not assume missing implementation from stale path text.
10. **Latest required concepts lack a full brief here.** No F19 absolute-deadline report, decision152 stored PP contract, AF07 rebuild receipt, SOS84fixture/2:1 detail, or release444 quiet-night cap specification appears in this assigned set. The governing prompt names them; Chef's other read-first packets must supply them. This is a scope-of-reading limitation, not missing repository evidence.

## Direct closure claims found, and their limits

The assigned set supplies only these useful completion-like statements: L1 helper/label/writer commits (`L2:46–50`, `L8:47–48`); L14 selector “done” (`L2:52–54`, `L9a:60–62`, `L16:33–35`); L9a closed (`L9c:6`); L9b/L18 closed then handed off (`FIX-LANES:61–62`); L13 registry commit456ba9e61 (`L10:56–58`, `L11:49–50`, `L18:47–48`); L9a exclusive-PK commit9cf384ff4 (`L10:60–61`, `L12:55–56`); L15 nullable commit12e55325d (`L10:63–67`); L12 v2 helpers fixed but unwired (F1/F2); candidate CTPI issued/v1 frozen (F5); physical migration applied as-is (L9a decision119); xG retired (CODEX-DEV). Each is **record-reported**, with target-source survival/tests/production readback unverified.

No lane has a complete failing-then-passing test transcript in these briefs. The extraction deliberately does not count “Done” checklists as closed findings or convert old blocked production steps into current blockers. Application audit findings, severity and release blockers belong to Chef's canonical ledger/report after direct evidence review.

## Specifically referenced Claude diaries (supplemental, read-only)

Chef requested the specifically referenced open-lane diaries after the initial pass. Read these two in full, without modification; no broad diary sweep. Exhaustive open-diary status is **not established** by this bounded assignment.

- `tasks/diaries/2026-11-11-claude-fix-l12.md:18–37` is the L12 diary requested explicitly by F1. It reports old-code failures for slate ratings/32-team writer/null tiers, then commit `690693c71` and 176/177 passing files (2,619 tests), an unrelated held UI mock failure and nullable-tier typecheck failure. Later grants report typecheck exit0,56files/389tests and clean ESLint. These are diary claims, **not rerun here**. Lines29–32 defer measured off-night research and CTPI v2 publication, and list normalizer/tier/UI reader tickets. Lines39–45 describe a partial availability reopen, then claim Top Adds availability/labels fixed across all four callers with old-code failures,22files/153tests, ESLint0/typecheck0. The earlier partial checkpoint is superseded **within this diary**, not a current open defect. The diary filename is Nov11 but its start/date is Nov12.
- `tasks/diaries/2026-10-31-claude-social-share-chef.md` is the existing dirty social-share Chef diary mentioned by L18:3, identified from repository state. Lines108–109 carry older open items: Codex player-card dependency, goalie source_account, PvP5.6 sourcing, Yahoo verification, PP rerun decision. Treat those as historical and unresolved by this file, not present-day assertions. Lines111–126 record the Crease Shift filters/labels work and claimed releases428/429, ending at the audit-range base `1cdb1dc8f`; no scope-target math validation is supplied. Earlier broad social checks/releases were read but are outside this worker's current closure evidence.

No exact open Claude diary is referenced elsewhere beyond the generic `_COMMON` diary naming template. `L12:50` also references Codex's goalie-grid diary; it is not an open Claude diary and was not read under this supplementary request. Side-session contracts and F1 notes remain external references for Chef's other prerequisite work.

## Complete file-read manifest

Generated after the reading pass. All 29 assigned records plus the three governing repository documents below were read in full. The local rollout was consulted only for worker identification and model/effort fields, not task evidence; directory existence checks found no nested AGENTS on the assigned paths. No memory files were used.

| File (repository relative) | Bytes | Lines | SHA-256 | Read |
|---|---:|---:|---|---|
| `AGENTS.md` | 17422 | 130 | `2f9a0ed93c56fee4acd7f7d9be06e04125465256c9b2d06c61a2ee3b9ba49ca2` | full |
| `mise-en-place.md` | 13785 | 96 | `29ea87cbf4c9addcf1d6ef6225884606ea3d7f33b36dc19377d8012f2aedd9af` | full |
| `tasks/artifacts/calculation-inventory-2026-11-10/master/ASTRA-FULL-AUDIT-PROMPT-20261114.md` | 23175 | 346 | `3ddf4fb52573b8d1379817d4b69d4f5a637e0a536afd9e20edb18f242d0343b1` | full |
| `tasks/artifacts/calculation-inventory-2026-11-10/master/FIX-LANES.md` | 9320 | 92 | `5e5f6d6a918a14958548ae7f4b10e80ec45ec625a1e74389902a8455905180c5` | full |
| `tasks/artifacts/calculation-inventory-2026-11-10/master/fix-lanes/CODEX-DEV-2026-11-13.md` | 6233 | 47 | `45895aa17ee57efaf615f74d003d133ba8f0fcc8875a5695a9cef08ce6754c32` | full |
| `tasks/artifacts/calculation-inventory-2026-11-10/master/fix-lanes/FOLLOWUP-LANES-2026-11-13.md` | 6231 | 63 | `baebbc417ae24dcf4d9d7f36e6c68a642812958ab476bbbe46ce76323cd96373` | full |
| `tasks/artifacts/calculation-inventory-2026-11-10/master/fix-lanes/L1.md` | 5826 | 42 | `309891cc7bbdd128b0c9d994022aa39a3058256eb7eb0d480ff389b4013f1fa8` | full |
| `tasks/artifacts/calculation-inventory-2026-11-10/master/fix-lanes/L10.md` | 8642 | 70 | `8cedbfef43a8145881cdd8dd0c3f90592bb990d5c44350a7085abab5fb31dbf1` | full |
| `tasks/artifacts/calculation-inventory-2026-11-10/master/fix-lanes/L11.md` | 6264 | 53 | `35fa45d3cbd6d22e59ba07a77f605d55e18b25b145d836ec6f60ddebc343e1d4` | full |
| `tasks/artifacts/calculation-inventory-2026-11-10/master/fix-lanes/L12.md` | 8815 | 62 | `a28cc327bc107ffa943f504051802566cf7557142d401e5332620c5159462556` | full |
| `tasks/artifacts/calculation-inventory-2026-11-10/master/fix-lanes/L13.md` | 5821 | 49 | `620a96f5304b01ae3b0b459555ae876ae9119c5641e2100bd7e3611a52c7c9d3` | full |
| `tasks/artifacts/calculation-inventory-2026-11-10/master/fix-lanes/L14.md` | 5346 | 42 | `774324abb0b97b39a40e9874efb055c8b4a92889436b25d44c9ba8baf237c3c1` | full |
| `tasks/artifacts/calculation-inventory-2026-11-10/master/fix-lanes/L15.md` | 6142 | 46 | `2d483e216ddd2e25b69c88af316ae8b13242d7d18cb062c93706be9c7c221390` | full |
| `tasks/artifacts/calculation-inventory-2026-11-10/master/fix-lanes/L16.md` | 3395 | 35 | `667d255507315f43441122635c4d555ac1fa097e98fb68d292068e9cdb63f023` | full |
| `tasks/artifacts/calculation-inventory-2026-11-10/master/fix-lanes/L17.md` | 3104 | 33 | `2337ddeec66efd64b2675231b29a4193ff5c3b5e28f51c02b120383cd86629d0` | full |
| `tasks/artifacts/calculation-inventory-2026-11-10/master/fix-lanes/L18.md` | 4563 | 48 | `be34bd53a128545ec456dde51cb4c6febb6d956e8b26430ef55499dcc16d3f23` | full |
| `tasks/artifacts/calculation-inventory-2026-11-10/master/fix-lanes/L19.md` | 1771 | 31 | `633a8c7d9bfa70e3f1e9598bbe25b88546312d84dd787e2f5851fef782454a50` | full |
| `tasks/artifacts/calculation-inventory-2026-11-10/master/fix-lanes/L2.md` | 8691 | 57 | `a496472b72fab7557e6afa8a69ec06996bd5a5d7f25b28158a97666b9850c94b` | full |
| `tasks/artifacts/calculation-inventory-2026-11-10/master/fix-lanes/L20.md` | 3378 | 33 | `0aaf92c8d24a089f57ffe4c99ed0888efbc7c3bb6321b50c20f4273f23627856` | full |
| `tasks/artifacts/calculation-inventory-2026-11-10/master/fix-lanes/L21.md` | 3306 | 34 | `9eb69581c15e6c4298513084ccad22234e37931fbe60fb3cfdbf117d8777d72b` | full |
| `tasks/artifacts/calculation-inventory-2026-11-10/master/fix-lanes/L22.md` | 4966 | 46 | `2e651e9dc86eec036ace1421efd93ba06e8606364c932186441e9630e36c54e5` | full |
| `tasks/artifacts/calculation-inventory-2026-11-10/master/fix-lanes/L3.md` | 4776 | 47 | `70364a3d111892a22972fb2346f03589f8a34fb3aaea153289e220106c39afb3` | full |
| `tasks/artifacts/calculation-inventory-2026-11-10/master/fix-lanes/L4a.md` | 6377 | 42 | `720117f3ec882be1fc018fa7382216b45fa4feabbd46f9c7b1f50ebae4d5ca4d` | full |
| `tasks/artifacts/calculation-inventory-2026-11-10/master/fix-lanes/L4b.md` | 6536 | 51 | `8f314fa492c92be8b2366f14ee3dbbb0db957ca549a33012fd52605507b231d1` | full |
| `tasks/artifacts/calculation-inventory-2026-11-10/master/fix-lanes/L5.md` | 7073 | 54 | `7f9c902a0ca8575bad333f392ff0aa29a0ea8c13f09d2feb4ad629c55f571010` | full |
| `tasks/artifacts/calculation-inventory-2026-11-10/master/fix-lanes/L6.md` | 5132 | 44 | `f6b394f5c9aa4dd0c604087edd09618d2edada5d7018d0267d408b1b771380d1` | full |
| `tasks/artifacts/calculation-inventory-2026-11-10/master/fix-lanes/L7.md` | 6181 | 54 | `e52eac693cbc2bfa38a70025ea2e39215f920708194ad4093a1ff9da82613c73` | full |
| `tasks/artifacts/calculation-inventory-2026-11-10/master/fix-lanes/L8.md` | 5885 | 52 | `246d835552c6f522b20336be32dfde04249d1bf0c9d284854c20aefdcc7cfd8a` | full |
| `tasks/artifacts/calculation-inventory-2026-11-10/master/fix-lanes/L9a.md` | 10356 | 72 | `b02ef8fb07ce21b100cd91b7d339b862ce343a8f3f6b3b7392d1b9f9195a0930` | full |
| `tasks/artifacts/calculation-inventory-2026-11-10/master/fix-lanes/L9b.md` | 6713 | 44 | `9f4a8f4e6f5bf0d89154495be6036ded4aad6eb493f76d5d7ea37c1d34564be7` | full |
| `tasks/artifacts/calculation-inventory-2026-11-10/master/fix-lanes/L9c.md` | 2795 | 23 | `635ceca08cbe875ae0dd9aca2e5c00549ee6213ddb03de417d58cf9da7d2de6a` | full |
| `tasks/artifacts/calculation-inventory-2026-11-10/master/fix-lanes/_COMMON.md` | 7675 | 46 | `1880011fcd8c642c6728f3715a595ab1a92a4db2cae66bb68c5b887c8daad558` | full |
| `tasks/diaries/2026-11-11-claude-fix-l12.md` | 5568 | 45 | `961f95f49bc057b1dbbd6d674e6ade23a4bc6abdef610c6082d153d2286ff10f` | full |
| `tasks/diaries/2026-10-31-claude-social-share-chef.md` | 28706 | 126 | `1d4f7bae9a41de9523fc4d7c491187b43e709c3cd49a07b51a7058ad1ad4acc7` | full |

Total: 34 full document reads; 29 assigned lane/index records, 3 governing documents, 2 specifically referenced Claude diaries. Unread sections within these documents: **none**. Referenced documents/code/tests/receipts outside this list were not read, except the field-limited runtime inspection below.

Runtime-metadata-only local files (not audit evidence; only model/effort values and assignment matching inspected; other contents not reviewed). Hashes/sizes below are snapshots of append-only files and may change as agents continue:

| Local rollout | Bytes at snapshot | SHA-256 at snapshot | Reviewed fields |
|---|---:|---|---|
| `/Users/tim/.codex/sessions/2026/11/14/rollout-2026-11-14T14-00-51-01a1db6f-0d95-7ce2-9343-f14415e66118.jsonl` | 1785911 | `22ea37920b70702e35ee01df54a845fa656486a87bb36a0f2523298e59523b81` | latest turn_context model/effort; exact worker-assignment match only |
| `/Users/tim/.codex/sessions/2026/11/14/rollout-2026-11-14T14-03-17-01a1db71-4971-7273-9a30-c95f2fd125dc.jsonl` | 1115477 | `5ec3866554c04a64febb5d5f575676c4c6afd4789598331e87cb0d6ab873cb6c` | latest turn_context model/effort; exact worker-assignment match only |
| `/Users/tim/.codex/sessions/2026/11/14/rollout-2026-11-14T14-03-28-01a1db71-7492-71f3-a97c-fd7a70e50f9b.jsonl` | 1158371 | `d0fa1d72ddbeb23764f34cbb752a000ca60e9988a9a1b92b3bd4c27f06c466b9` | latest turn_context model/effort; exact worker-assignment match only |
| `/Users/tim/.codex/sessions/2026/11/14/rollout-2026-11-14T14-03-39-01a1db71-a255-7462-a174-7aa5a1af4b2a.jsonl` | 1555795 | `8e0264d30f722f3bba3cc0771344fee08f86f38d470dd15f6cab935ae968fa73` | latest turn_context model/effort; exact worker-assignment match only |
