# W1-11 audit: RSO / roster optimizer (M-RSO-001 to 060)

Auditor: Claude (Fable), 2026-11-11, on `octoberBranch` at `5cff74faa`. Read-only: no code, data or configuration was changed. Paths are relative to `web/` unless they start with `tasks/` or `supabase/`.

**Evidence labels used below**
- **Run**: I executed the repository's own code on synthetic inputs, outside the repo (scripts listed in section 6).
- **DB sample**: a bounded, read-only production read on 2026-11-11 (idle database confirmed first). Dated sample evidence, not a population rate.
- **Read**: established by reading the code only.
- **Agent read**: read by a research sub-agent and not re-verified by me, except where I say so.

## 1. Summary

| Verdict | Count | Entries |
|---|---:|---|
| Sound | 36 | 002, 004, 005, 009, 010, 011, 012, 015, 019, 021, 023–029, 031, 033, 034, 036, 038, 041, 044, 045, 047–055, 057, 059 |
| Mis-specified | 16 | 003, 006, 008, 013, 016, 018, 020, 022, 032, 037, 040, 042, 043, 046, 056, 058 |
| Wrong | 7 | 001, 007, 014, 017, 030, 039, 060 |
| Undetermined | 1 | 035 (needs an owner rule) |

**The done-criteria from the brief**
- *Daily assignment proven optimal:* yes. Both assigners matched exhaustive search on every instance tried (4,000 mine, 60,000 by the sub-agent), and they agree with each other whenever the planner is in "most starts" mode.
- *Ranking basis stated and unit-consistent:* no. The streaming rank mixes an unconditional projection with a per-game-played average (D1).
- *Goalie expected stats reconcile:* no. The bridge has W + L = 1 per start. Observed this season: W + L + OTL = 0.982 per start, and L alone is 0.377, not 0.508 (D3).
- *Zero-versus-unknown decided and tested:* decided by the owner (decision 3), not implemented. The zero is still a known zero to every reader (D2).

**Top 5 findings by user impact**

1. **Streaming rank is half raw recent form, on the wrong basis (C13; M-RSO-007, 060; P0).** Reproduced: a free agent projected at 1.0 FPts a game with one recent 4-point game is recommended over one projected at 2.0 with ten games of form. The chain shown gains +2 projected FPts where +4 was available. For goalies the mismatch more than doubles a backup's worth relative to a starter.
2. **Players with no FORGE line are a known zero, and the "never auto-drop an unknown" rule doesn't hold in the planner (C15; M-RSO-014, 030; P0).** FORGE writes about 18 skaters a team, and the reserve table that would cover the rest doesn't exist in production. In the 2026-11-11 sample, 101 of 673 skaters who had played in the previous 14 days had no current line. Separately, a player with no forecast at all still enters the drop order, and can be first: reproduced.
3. **Goalie losses are overstated by about a third (C14; M-RSO-017; P0 in leagues that score losses).** The bridge sets L = 1 − W per start. This season starters took a regulation loss in 37.7% of starts; the bridge's average is about 50.8%.
4. **Any game under way turns the whole plan into a schedule-only plan (M-RSO-001; P1).** Reproduced: once a rostered skater's game has started and someone is benched for a later game, the bench check returns "unresolved", and the plan loses its points comparison.
5. **The chain search counts one player in two windows, so more adds can give a worse plan (M-RSO-039; P1).** Reproduced: with 3 adds the suggested chain nets +8.5 FPts; with 1 add it nets +10.

Close behind: goalie start chances on the second night of a back-to-back (M-RSO-018, P1).

## 2. Per-entry table

"Ref" is the standard compared against. HM = Hungarian method / min-cost max-flow, checked by brute force. OD = `OWNER-DECISIONS.md`. BA = `BATCH-A-CONSOLIDATED.md` cross-cutting rule.

| ID | Verdict | Evidence | Ref | Magnitude | Downstream |
|---|---|---|---|---|---|
| 001 bench explanation | **Wrong** | `lib/rosterScheduleOptimizer/planning.ts:1046-1072` (removed rows include started rows, whose value is null); `benchDecisions.ts:97-102`, `:148-154`. Run E6 | Internal | Plan drops to `schedule_capacity`, `comparisonEligible=false` whenever a rostered skater's game is live and a later-game player is benched | Bench reasons, net points, objective choice |
| 002 contribution ledger | Sound | `contributionLedger.ts:46-99` (agent read) | Internal | — | Bench days, drop order |
| 003 schedule evaluation | Mis-specified | `optimizer.ts:193-293`, `:346-362` (agent read) | `docs/roster-schedule-optimizer.md:27` | DUST rate matches the docs. Slot utilization divides by every league date, and position bench games double count (9 shown for a true 6 in the agent's example). Neither field has a consumer | Draft DUST |
| 004 plan totals | Sound | `planning.ts:892-945` | Internal | Projected value includes banked points; nets cancel it | All plan cards |
| 005 candidate ordering | Sound | `candidatePlanMetrics.ts:39-68` (agent read) | Internal | Transitive | Candidate browser |
| 006 candidate metrics | Mis-specified | `candidatePlanMetrics.ts:96-100`, `:170`, `:198` | Internal | "Most starts" plans are netted against the points lineup. That lineup leaves zero- and negative-value games unstarted (770 of 4,000 random rosters, run), so net active games can be overstated by those games | Best Fit swaps |
| 007 streaming rank | **Wrong** | `streamingChain.ts:187-190`, `:73-82`; `recentForm.ts:49-65`; `lib/rosterScheduleData/planning.ts:384` ("no form bonus is added"). Runs E1, E1c | OD 2; Tango shrinkage | Section 3, D1 | Streaming itinerary, every chain |
| 008 category dominance | Mis-specified | `planning.ts:1097` | Comment `:66` ("native-unit partial order") | In category leagues one more active game makes a plan "better" even when a ratio category gets worse (41 starts at GAA 3.10 beats 40 at 2.60) | Plan frontier in category leagues |
| 009 opponent tilt | Sound | `lib/rosterScheduleData/forgeDailyBridge.ts:123-156` | Shrink toward 1 | Mirror keeps the team total at 1 at the league mix (checked algebraically). 20/30-game weights and ±15% are unvalidated | Bridge skater lines |
| 010 legacy win model | Sound | `forgeDailyBridge.ts:188-197` | Poisson race | Packet says dead code: **it is live** in `pages/api/v1/db/forge-served-forecast-snapshot.ts:92-93` as the ledger's naive baseline | Served-forecast ledger |
| 011 season rates | Sound | `forgeDailyBridge.ts:219-249` | n/(n+k) shrinkage | GWG prior 0.16 ≈ one winner per ~6.2 goals. Faceoffs are unshrunk (k = 0) | PIM, +/−, SH, GWG, FO lines |
| 012 PP zero policy | Sound | `forgeDailyBridge.ts:257-262` | BA 5 | Unknown stays unknown | Bridge lines |
| 013 skater retargeting | Mis-specified | `forgeDailyBridge.ts:171-184`, `:509-513` | Internal | Shots are scaled by the goals-for term, and PP stats by an all-strength term. Each term is clamped to ±20% upstream (`lib/projections/calculators/team-context-adjustments.ts:56-76`). Not sized | Every re-aimed line |
| 014 reserve and no-line zeros | **Wrong** | `forgeDailyBridge.ts:444-448`, `:651-685`; `bridgeForecastWire.ts:63` (uses all true). DB sample | OD 3; BA 5 | Section 3, D2 | Totals, drop order, streaming |
| 015 team-strength priors | Sound | `forgeDailyBridge.ts:91-120` | Pseudo-count blend | Triage's "not a unit mix" confirmed. This season's xG is `nhl_team_data`, last season's is NST: scale agreement unchecked | Bridge context |
| 016 later-period impact | Mis-specified (dormant) | `futureImpact.ts:10`, `:236-242`; `laterImpactInputs.ts:32` (agent read) | Internal | Doubly gated off. If enabled, every lineup player would read `conditioning_unknown` | None live |
| 017 goalie line and wins | **Wrong** | `forgeDailyBridge.ts:624-626`, `:200-207`; `lib/projections/stages/goalie-stage.ts:656-685`. DB sample | Yahoo W/L; NHL W-L-OT record | Section 3, D3 | Goalie points, category L |
| 018 start probabilities | Mis-specified | `forgeDailyBridge.ts:565-607`, `:83` | W1-5 audit | Section 3, D6 | Goalie expected stats, minimum |
| 019 coverage target, window | Sound | `planning.ts:54-58`, `:484-503` | Internal | The UTC-noon weekday lead is not a defect: the input is already a league-local date | Goalie coverage |
| 020 projected starts, risk | Mis-specified | `planning.ts:948-970` | Internal | Compares an expected count with a whole-number minimum. Two 50% starts for a minimum of 1 reads "met" at a 75% chance; 1.9 for 2 reads "at risk" | Goalie minimum banner |
| 021 Yahoo start override | Sound | `providerGoalieStarts.ts:40-62` | Internal | Skips team-games with an unknown chance, so it never scales past an unknown | Goalie rows on game day |
| 022 healthy reserves | Mis-specified | `healthyReserves.ts:60-112` (agent read) | Internal | Each gain is an "alone" figure; two players sharing one slot can both show the same +6.0 | Reserve alert |
| 023 eligibility | Sound | `eligibility.ts:61-106` (agent read) | Yahoo slots | — | Both assigners |
| 024 lineup gaps | Sound | `lineupGaps.ts:45-118` (agent read) | Internal | A known 0 becomes `bestDrop` (see D2) | DROP chip |
| 025 DUST assignment | Sound | `matching.ts:142-190`. Runs | HM | 0 mismatches in 60,000 (agent) and 4,000 (mine) | Draft DUST, autopsy |
| 026 planner assignment | Sound | `planning.ts:400-482`; `lib/projections/weightedAssignment.ts:2-41`. Run | HM | 0 mismatches in 4,000, both modes | Every plan |
| 027 slot expansion | Sound | `slots.ts:28-80` (agent read) | Internal | — | Both engines |
| 028 streaming capacity | Sound | `streamingChain.ts:83-94`, `:162-169` | Kuhn matching | Counts starts only, as labelled | Chain windows |
| 029 acquisition timeline | Sound | `planningTimeline.ts:13-65`, `:134-158` (agent read) | Internal | Null cost is charged as 1, flagged, and the plan discarded | Legality |
| 030 drop order | **Wrong** | `planning.ts:1314-1319`; `retention.ts:77-88`. Run E4 | OD 3; `retention.ts:68-70`, `:80` | Section 3, D2 | Planner, streaming, Best Fit |
| 031 candidate DUST | Sound | `optimizer.ts:365-481` (agent read, 20,000 runs) | Docs `:19-25` | — | Draft DUST |
| 032 alternatives | Mis-specified | `recommendations.ts:62-86` (agent read) | Docs `:77` | The 5% value-loss test is applied to a zero-centred Z-sum in category leagues: 0.40 against 0.30 is a "25% loss" | Draft DUST |
| 033 DUST risk | Sound | `risk.ts:20-41` (agent read) | Docs `:71-77` | Rate gate makes the labels horizon-dependent, as documented | DUST badge |
| 034 Roster Autopsy | Sound | `lib/rosterAutopsy/manual.ts:186-214` (agent read) | Max matching | "Short" is a necessary condition only; unfilled slots are reported separately | Roster Autopsy |
| 035 plan order, safe gate | Undetermined | `planning.ts:1120-1174` | None written | A "most starts" plan with a drop is "safe" while its points cost is unknown. Needs a rule (triage question 14) | Plan list |
| 036 work quotas | Sound | `planning.ts:1176-1188` (agent read) | Internal | Budgets shrink as the pool grows | Search depth |
| 037 schedule fits | Mis-specified | `planning.ts:1206-1218` (agent read) | Internal | One lowest-id player stands for his group; groups are cut alphabetically by team | Shortlist |
| 038 beam search | Sound | `planning.ts:1356-1485` (agent read) | Internal | Honestly labelled best-found | Plans |
| 039 chain search | **Wrong** | `streamingChain.ts:253-302`. Runs E3, E5 | Internal | Section 3, D5 | Streaming itinerary |
| 040 client tallies | Mis-specified | `components/RosterScheduleOptimizer/BenchDays.tsx:19-37` (agent read) | Label | Reserve, off-roster and cancelled days are shown as "no game" | Bench days |
| 041 tercile tiers | Sound | `components/RosterScheduleOptimizer/SlotWeekGrid.tsx:229-245` (agent read) | Internal | A tie at the cut makes everything "mid" | Lineup grid |
| 042 itinerary totals | Mis-specified | `components/RosterScheduleOptimizer/StreamingItinerary.tsx:11-20`, `:94-113` (agent read) | Label | Header "AGP" is net; the per-add "AGP" is gross | Streaming totals |
| 043 shortlist | Mis-specified | `planning.ts:1226-1240` (agent read) | Internal | No projected points in the order, so a high-points player who adds no starts can be cut at 40 in a points league | Planner pool |
| 044 5% similarity | Sound | `components/RosterScheduleOptimizer/CategoryGains.tsx:29-43` (agent read) | Internal | Symmetric, disclosed | Points comparison |
| 045 source selection | Sound | `lib/rosterScheduleData/planning.ts:213-231` (agent read) | Internal | Coverage counts are computed but never shown | Data API |
| 046 transport trimming | Mis-specified | `forgeDailyBridge.ts:686-698`, `:730-731` | Internal | Cut by game time, not by relevance; disclosed in the evidence text | Late-window games |
| 047 coverage accounting | Sound | `planning.ts:29-48`, `:329-398` (agent read) | BA 5 | — | Evidence panel |
| 048 unknown contamination | Sound | `planning.ts:427-467` | BA 5 | Bridge rows never get the conditional tie-break | Start/sit |
| 049 lineup refinement | Sound | `planning.ts:505-623` | Internal | Bounded search, labelled "not a proven optimum" | Goalie coverage |
| 050 started-game locks | Sound | `planning.ts:691-727` | Yahoo daily locks | Sound alone; D4 is the bench check built on it | Live days |
| 051 weekly aggregation | Sound | `planning.ts:761-834` | Internal | Read only; no weekly brute force | Weekly leagues |
| 052 schedule, week mapping | Sound | `weeks.ts:17-45` (agent read) | Docs `:49-55` | — | DUST |
| 053 latest action time | Sound | `planning.ts:1246-1256` (agent read) | Internal | — | Move timing |
| 054 schedule freshness | Sound | `planning.ts:625-636` (agent read) | Internal | Three 36 h constants agree | Warnings |
| 055 time-zone math | Sound | `planningDates.ts:15-26` (agent read) | IANA zones | 10 failures in 305,140 zone-dates, none in North America | Boundaries |
| 056 form label, chips | Mis-specified | `lib/rosterScheduleData/planning.ts:378-382`, `:396-408` (agent read) | Label | "Scoring hot" has no staleness limit inside 30 days; line number is inferred from array order | Player rows |
| 057 intent reconciliation | Sound | `reconciliation.ts:59-131` (agent read) | Internal | — | Refresh |
| 058 ownership freshness | Mis-specified | `lib/rosterScheduleData/planning.ts:295-320` (agent read) | Comment "≤ 3 days" | Effective window is today minus 2 days | Drop caution |
| 059 team schedule context | Sound | `components/RosterScheduleOptimizer/TeamScheduleContext.tsx:18-65` (agent read) | — | Consumer only | Context strip |
| 060 chain ranking | **Wrong** | `streamingChain.ts:328-336`, `:361-368` | OD 2 | Chains are ordered by the blended net, not the evaluator's projected net (same cause as 007). The header prints both | Chain choice |

## 3. Defects

### D1 (P0). Streaming rank blends raw recent form with the projection: M-RSO-007, 060 (C13)

**What the code does.** Per player-game, score = (projected FPts + last-10 FPts per game) ÷ 2 when form exists, else the projection alone (`streamingChain.ts:187-190`). The score ranks candidates in every window, values the dropped player, and orders certified chains ahead of the evaluator's own net points (`:361-368`).

**Why it is wrong against decision 2**
- **No shrinkage.** "Last 10" is up to ten games played in the last 30 days, with no minimum (`recentForm.ts:29-30`; `lib/rosterScheduleData/planning.ts:46`, `:348-358`). One game gets the same 50% weight as ten.
- **Different basis.** The projection is unconditional: a goalie's is his per-start line times his start chance. Form is per game he actually played.
- **Mixed across candidates.** A player with no recent games is ranked on projection alone, next to players ranked on the average.
- **It contradicts the code's own statements.** `recentForm.ts:50`: "A hint only: never a projection input". The form evidence text says "no form bonus is added" (`lib/rosterScheduleData/planning.ts:384`).

**Magnitude**

| Case | Evidence | Result |
|---|---|---|
| E1: "steady" 2.0 a game with 2.0 form over 10 games; "hot" 1.0 a game with one 4-point game | Run | "hot" is recommended. Certified net +2 FPts; +4 was available. Without form the same week picks "steady" |
| E1c: 1.9 a game with no form; 1.0 a game with 3.0 form over 10 | Run | The 1.0 player wins (2.0 against 1.9). Net +2 against +3.8 available |
| Goalies, form equal to the per-start value S | Arithmetic from the formula | Starter at 80%: 0.90 S. Backup at 25%: 0.625 S. True ratio 0.31; ranked ratio 0.69. The backup is valued at 2.2 times his real relative worth |
| How much skill a raw short mean has | W1-8 audit, 2,215 skater-games over 10 slates (reported sample) | Goals RMSE: raw season mean 0.4452, league constant 0.4479, FORGE bridge 0.4336. A raw mean adds almost nothing, and it gets half the weight here |

**Fix**
1. Stopgap: rank on the projection alone. Form already breaks near ties (`:79-80`), which matches "a hint only".
2. Then, if form is to count: put it on the projection's basis first (FPts per **team** game over the window, zeros included; for a goalie, per-start form × start chance). Blend as (n × form + k × projection) ÷ (n + k), with k fitted on the served ledger per stat family. Any k is a hypothesis until it is validated on held-out dates.
3. Rank chains on one number. If the blend survives, show it as the ranking number; don't order by one figure and headline another.

**Tests**
- A one-game sample can't move a candidate past a rival whose projection is 20% higher.
- Two goalies with the same per-start line and form: the ranking ratio equals the start-chance ratio.
- A candidate with no form and one with form equal to his projection rank by projection alone.
- Chain order agrees with the number printed as its total.

### D2 (P0). "No FORGE line" is a known zero, and unknowns still enter the drop order: M-RSO-014, 030 (C15)

**Why the player gets an all-zero line (decision 3 asked for the cause)**
1. **FORGE projects the dressed lineup only.** Every run from 11-04 to 11-15 holds 17.4 to 18.0 skater rows per team and one goalie row per team (DB sample).
2. **The reserve pass that would cover everyone else is not in production.** `forge_reserve_projections` does not exist there (query error 42P01), although its migration is in the repo (`supabase/migrations/20261027090000_forge_reserve_projections.sql`). So every scratch, returning player and call-up falls through to the zero path.
3. **The lineups are frozen.** The newest run was created on 2026-11-09 10:35 UTC. Anyone who rejoined a lineup since is "missing from his team's latest run".
4. **The zero is deliberate** (TJ option B, 2026-10-26; `forgeDailyBridge.ts:639-642`), so one uncovered player doesn't blank the whole plan. But the row carries `allowedUses` all true, and nothing in `lib/rosterScheduleOptimizer/` reads the reserve code. The label reaches the screen; the planner sees a real 0. Reserve skaters without confirmed news and goalies with an unknown start chance get the same treatment (`:444-448`, `:631-633`).

**Size (DB sample, 2026-11-11).** Of 673 skaters with an NHL game from 10-28 to 11-10, **101 (15%) are not in their team's latest FORGE lineup**. 23 of them played at least four games in that span (0.39 points a game on average, one at 1.4), and 33 played on or after 11-07. My join was by player only, and Yahoo identity mapping wasn't checked, so the count actually served may differ.

**What it does downstream**
- **Drop order.** In a points league the zero is the lowest known contribution. Run E4: the order is `zero, low, core`, and the streaming chain proposes "add fa, drop zero". The DROP chip picks him too (`lineupGaps.ts:60`).
- **The "unknown is never an automatic drop" rule is not enforced in the planner.** `noMoveDropOrder` ranks by projected points, then by active games (`planning.ts:1314-1319`). The games tier is always a finite number, so no player is ever "absent" as `retention.ts:80` promises. Run E4c: a roster with one no-forecast player gives the order `unknown, low, zero, core`, and both the plan alternatives and the streaming chain propose "add fa, drop unknown". Only the DROP chip (`suggestedDrop`) keeps the rule.
- **Streaming.** A zero-line free agent with recent form scores form ÷ 2 a game under D1. Certification stops most of these, but the window's single proposal is wasted on him.
- **Net active games.** A 0-value game ties with an empty slot in points mode, which feeds the miscount in M-RSO-006.

**Fix**
1. Remove the cause where possible: apply the reserve migration and decide on the reserve pass, as its own approved step. Separately, a fresh run fixes staleness once the pipeline hold is cleared.
2. Give the zero a machine-readable marker and make every reader honour it (BA rule 4): `noMoveDropOrder`, `knownDropOrder`, `suggestedDrop`, `candidatePlanMetrics`, the streaming drop list and pool, and `lineupGaps`. A marked player's contribution is **unknown** for drop ranking and candidate ranking, and shows as no data.
3. Make the active-games tier return null for a player whose points are unknown in a points league, so "absent from the order" means what the comment says.
4. Whether lineup totals still count him as 0 is the owner's call (question 2).

**Tests**
- A roster with one no-line player and one low projected player: the low player is the first proposed drop; the no-line player is in no automatic proposal.
- A no-forecast player is in no plan alternative and no streaming chain as the dropped player.
- Every reader listed above has a selection test that fails if it treats the marked row as a known 0.

### D3 (P0 where losses score). Goalie losses = 1 − wins: M-RSO-017 (C14)

**What the code does.** Per start, W = P(team wins) × 0.984 and L = 1 − W (`forgeDailyBridge.ts:624-626`). Overtime and shootout losses, no-decisions and wins credited to a reliever are all counted as losses.

**Magnitude (DB sample: `wgo_goalie_stats`, 2026-10-01 to 2026-11-10, 568 starts)**

| Per start | Observed | Bridge at the same average | Gap |
|---|---:|---:|---:|
| Wins | 0.496 | 0.492 | fine |
| Losses (regulation) | 0.377 | 0.508 | **+0.131, +35%** |
| Overtime losses | 0.109 | not modelled | |
| No decision | 0.018 | 0 | |
| W + L + OTL | 0.982 | 1.000 | |

- The observed decision share (0.982) agrees with FORGE's 0.984 constant.
- **Internal inconsistency, whatever Yahoo's rule is.** Recent form scores `LOSSES_GOALIE` from the `losses` column (`recentForm.ts:11`), which excludes overtime losses. So the same stat key has two definitions inside the D1 blend.
- If a league did count overtime losses as losses, the overstatement would shrink to about +0.02 a start. See question 1.

**Fix.** Split the non-win mass: L = (1 − P(win)) × (1 − OT-loss share of losses) × decision share, with OTL separate. FORGE's win model already holds the tie mass (`lib/projections/goalie/goalieOutcomes.ts:118-121`); a league constant (about 22% of losses this season, 62 of 276) is an acceptable first step if labelled.

**Tests.** Per start, W + L + OTL = decision share within rounding. On a stored season sample, mean projected L per start is within 0.02 of observed.

**Two smaller points in the same entry (P2)**
- **The "per-start line" is a team-slot blend.** FORGE stores a start-probability-weighted mix of its candidates' lines under the selected goalie's id (`goalie-stage.ts:656-685`; `lib/projections/calculators/goalie-starter.ts:44-72`), as Astra found in W1-5. The weights sum to 1, so it isn't double-discounted; a starter's line is pulled slightly toward his backup's. Not sized.
- **Shutout re-aiming divides a probability by the goals-against ratio** (`:206`). Under a Poisson zero the right move is p^ratio. For p = 0.055 and +10% goals against: 0.050 served, 0.041 correct.

### D4 (P1). A game under way makes the bench check fail for the whole plan: M-RSO-001

**What the code does.** For a benched points-league skater, the forced-placement delta is the sum of new row values minus the sum of removed row values (`planning.ts:1062-1067`). The removed rows include today's started rows. Those have no entry in the play map, so their value is null and the delta is null. No placement qualifies, the reason becomes `decision_unresolved`, and that flag clears `comparisonEligible` and sets the mode to `schedule_capacity` for the whole evaluation (`benchDecisions.ts:97-102`, `:148-154`).

**Magnitude.** Run E6: three skaters, slots C and UTIL. Before any game starts: mode `quality`, comparison eligible, bench reason "lower lineup value". With one rostered skater's game started and locked: mode `schedule_capacity`, comparison not eligible, bench reason "decision unresolved". This fires on any day with staggered start times, for the rest of that day. The sub-agent found it by reading; I reproduced it.

**Fix.** Leave started and held rows out of both sides of the delta (they can't move), and keep their slots out of the forced matching.

**Test.** The E6 fixture: the evaluation stays comparison-eligible and the later-game bench row gets a real reason.

### D5 (P1). The chain search counts a player in two windows: M-RSO-039

**What the code does.** The window DP values each leg at that window's top-ranked player (`streamingChain.ts:253-268`). When legs are turned into picks, a player already used is skipped for the next one down (`:288-293`), but the plan's value and the choice of windows are not recomputed. Only one chain per drop and goal is certified, so a better chain is never tried.

**Magnitude.** Run E3 (one open spot; A plays Monday and Friday at 5 a game, B plays Tuesday to Thursday at 1, D plays Friday at 0.5):
- With 3 adds: suggested A → B → D, 3 adds, certified **+8.5** FPts. The DP believed A → B → A, 13.
- With 1 add: suggested "hold A", certified **+10**.
- Giving the search more adds made the recommendation worse. The numbers shown are the certified ones and are correct; the choice is not the best available.

**Related (question 5).** Run E5: on the last day of the range the chain drops a 3.0-a-game regular for a one-game +2, because nothing after the range has value. The later-impact estimate that would price this is gated off (M-RSO-016).

**Fix.** Track used players in the DP state for the small candidate sets involved, or re-run the DP after each dedupe until the picks are stable. Always certify the "hold the best single streamer" chain as a floor.

**Tests.** Best certified net with k + 1 adds is never below the best with k adds on the same inputs. No player appears in two legs of one spot.

### D6 (P1). Goalie start chances: M-RSO-018

- **Inherited input.** Shares are the raw last-10 start share (`forgeDailyBridge.ts:340`), which W1-5 found wrong (a 90% share started 60% of the time, reported sample of 2,311 team-games). FORGE's own probability overrides it only for an already projected game.
- **Back-to-backs.** On a second night the highest-share goalie keeps 55% of his chance (`:83`, `:588-594`), whoever started the night before. W1-5 measured that the goalie who started the first night starts the second 8.7% of the time (392 team-games, reported). A 65% starter is served at 36% where the evidence says about 9% if he played last night, and well above 65% if he didn't.
- **News floors** (80% likely, 65% projected) are unvalidated and say so.
- **Good:** unknown shares stay unknown and are never scaled up (`:573-580`), which follows BA rule 5.

**Fix.** Take the W1-5 fix order (actual-start outcome, timestamps, pregame cutoffs, then a fitted model). Until then, condition the back-to-back rule on who started the first night, where that is known.

**Test.** On stored history, the second-night start rate of the first night's starter in each served probability bin is within tolerance of the served value.

### Smaller defects (P2)

| Entry | Fix | Test |
|---|---|---|
| 006 net active games | Net each plan against the no-move lineup of the same objective | A plan identical to the roster shows net 0 under both objectives |
| 008 category dominance | Don't let a start count override a worse category; report a tradeoff | 41 starts with a worse GAA against 40 with a better one returns "tradeoff" |
| 013 retargeting | Scale shots with the shots term and PP stats with a PP term, or label the approximation | Re-aiming to an opponent with average shots against leaves shots unchanged |
| 020 minimum risk | Report the chance of reaching the minimum (Poisson-binomial over team-games) beside the expected count | Two 50% starts for a minimum of 1 reads 75% |
| 043 shortlist | In points leagues add net projected points to the ordering | A top-points free agent who adds no starts survives the cut |
| 003, 022, 032, 037, 040, 042, 046, 056, 058 | Label or definition corrections as described in the table | One assertion each on the corrected label or bound |
| 010 | Correct the docstring and the inventory: it is live in the ledger snapshot route | — |
| 016 | Before enabling: select `conditioning` for lineup rows | Lineup arms are not all "unknown" on a fixture |

## 4. Questions for the owner

1. **Yahoo losses.** Do your leagues' "L" exclude overtime and shootout losses (I believe they do, as the NHL's loss column does)? That sets the size of D3.
2. **No-line players in totals.** Once they are unknown for drops and rankings, should a lineup's projected total still count them as 0, or become "incomplete"?
3. **Streaming rank stopgap.** Rank on the projection alone until a shrunk, same-basis blend is fitted and validated?
4. **"Safe" plans (M-RSO-035).** Is a "most starts" plan with a drop safe to suggest when its points cost is unknown?
5. **Last-day drops.** Should a chain be allowed to drop a rostered regular for a one-game gain on the final day of the range?
6. **Category leagues (M-RSO-008).** Should one more start outrank a worse ratio category, or show as a tradeoff?
7. **Reserve pass.** Should the reserve-projections migration be applied and the pass enabled, as a separate approved step?

## 5. Limits

- **Synthetic runs.** E1 to E6 use fictional players and a single-stat scoring rule, on the fixture shape from `lib/rosterScheduleOptimizer/streamingChain.test.ts`. They prove the mechanism, not how often it happens in real leagues.
- **Goalie blend not run.** The 2.2× figure is arithmetic from the formula; my harness only admitted a skater stat.
- **DB samples are dated** (2026-11-11) and small. The 101-of-673 count joins by player only and doesn't check Yahoo identity mapping, traded players or what the bridge actually served. FORGE runs are on hold, so the count is inflated by staleness.
- **Yahoo's scoring rule for L was not checked** (no Yahoo calls allowed).
- **Sub-agent entries.** 32 entries rest on sub-agent reading (marked). I re-verified M-RSO-001 by run, and 006, 008 and 010 by reading. The rest I did not re-read.
- **Not sized:** the retargeting approximations (013), the team-slot blend (017), the xG source mix in the team prior (015), and how often transport trimming fires (046).
- **Not executed:** the repository test suites and the Playwright fixtures in `e2e/`. Weekly-lineup assignment (051) was read, not brute-forced.
- **Upstream numbers** quoted from W1-5 and W1-8 are those audits' reported samples.

## 6. Reproduction notes

Scripts are in the session scratchpad, not the repo: `/private/tmp/claude-501/-Users-tim--claude-spares-spare-TbC4Ej/de2890f2-d3b5-443a-803f-173016601628/scratchpad/w11/`. They bundle the repo's TypeScript with the repo's own `esbuild` and run it in Node; the forecast-permission policy is replaced by the test fixture's policy at bundle time.

| Run | Script | Inputs |
|---|---|---|
| Assigners against exhaustive search | `assign.ts` | 4,000 random rosters (seed 12345), 1 to 7 players, six slot sets, zero and negative values. Result: 0 illegal, 0 non-optimal in either planner mode, 0 for the DUST matcher, 0 disagreements between DUST and "most starts"; points mode started fewer than the maximum in 770 |
| E1, E1c | `run2.ts` | Week of 2026-10-26, slots C 1 and UTIL 1, one idle roster player to drop, 1 add |
| E3, E5 | `run3.ts` | As described in D5; "core" protected in E3 |
| E4, E4c | `run2.ts`, `run3.ts` | Roster of core (3.0), low (0.2), zero (0.0) and, in E4c, a player with no forecast rows |
| E6 | `run4.ts`, `run5.ts` | Three skaters, slots C 1, UTIL 1, BN 1; one game moved to before the planning time with a provider lock |

Production reads (all read-only, each preceded by a `pg_stat_activity` check showing 0 active queries):
1. `wgo_goalie_stats` sums for 2026-10-01 to 2026-11-10 (598 rows).
2. `forge_runs` for as-of dates 11-04 to 11-18 with per-run row counts (30 runs).
3. Latest-lineup membership against `rosters`, and against skaters with a game from 10-28 to 11-10 in `wgo_skater_stats`.
4. Column lists from `information_schema`.
