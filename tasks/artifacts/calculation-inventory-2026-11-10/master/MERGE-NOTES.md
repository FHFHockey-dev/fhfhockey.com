# Merge notes: master calculation inventory (Opus × Codex), 2026-11-10

## Sources

- **Opus inventory:** `tasks/artifacts/calculation-inventory-2026-11-10/calculations-opus.json` (1,029 entries; commit dc44c0790), with `audit-context-opus.json` for intent and fixtures. Line numbers observed at octoberBranch d31dcb33f plus the dirty working tree of that morning.
- **Codex (Astra) inventory:** not copied into the repo. Unpacked at `~/Library/Application Support/Claude/side-session-notes/local_c4e6c533-96aa-4670-aedf-8a5331a449da/codex-calc-inventory-2026-11-10/` (start with its README.md); zip sha256 begins `4fc10c2d` (prefix as relayed by Chef; the zip itself is not in the folder). 1,318 records = 1,037 primary calculation records + 281 supplemental symbol candidates; inspected at HEAD 11e4192d3 (initially d31dcb33f). Its contextual-metric-registry, SQL declaration census, whole-source candidate census and coverage notes are referenced, not merged record by record.
- Both lists are treated as data. Nothing in either was executed.

## Method

1. **Location crosswalk.** Every pointer was parsed to (file, line range, symbol). An Opus entry and a Codex record are linked when they cite the same file and either the same symbol or line ranges within 8 lines.
2. **Confidence grading.** Opus summary entries (for example the FORGE stage map or the xG includes/excludes checklist) cite many files and would otherwise absorb unrelated Codex records. A link is kept as a pair when the names share at least 20% of their tokens, when the Opus entry links to at most 3 Codex records, or when the Codex record sits in the Opus entry's primary file (relation `codex_part_of_opus`: Codex split one Opus entry into several records, e.g. the 53 game-prediction features under GPR-012). Other links are recorded only as low-confidence `possible` cross-references, and those Codex records count as Codex-only.
3. **Same-file name match** for the remaining Opus entries: a Codex record in the same file but farther away pairs when name-token Jaccard is at least 0.4 (relation `name+file`).
4. **Master entries** are anchored on Opus entries (with their paired Codex records attached); every Codex record with no kept pair becomes its own Codex-only entry. Result: 1358 entries; both 592, Opus only 437, Codex only 329 (258 primary, 71 symbol candidates); 1283 pairs (location 888, codex_part_of_opus 394, name+file 1); 138 possible links.
5. **Conflicts** (rule-based, on kept pairs only): output scale 0–1 fraction vs 0–100; TOI seconds vs minutes in the input units; status worded live on one side and legacy on the other. Both sides are quoted; none is resolved.
6. **Leads** = every Opus red flag plus every Codex `unknowns` text on the attached records, labelled by source. Not audited.
7. **Tags** (keyword heuristics over both descriptions) keep Codex's distinctions visible: percent scale (fraction 0–1 / 0–100 / both), conditionality (unconditional / conditional on appearance / on game played), denominators (per 60, per game, per appearance, per team game, 5v5, all strengths, unblocked attempts, shots on goal) and generation (legacy, research, development, current). Codex's own family label is kept on every Codex view.
8. **Packets:** one file per master family in `packets/`, split into parts of at most 60 entries. Each entry carries both views, conflicts, audit context (Opus intent, Codex intended contract, references, fixtures, tests) and leads.

## Why mechanical

Six read-only matching agents (semantic matching, conflict reading and code re-checks per family) were started and then stopped before writing results because they were using up TJ's 5-hour usage window. TJ chose to finish mechanically with no agents. The prepared agent inputs and brief are in the session scratchpad (`merge2/`), so a single-agent semantic pass can be resumed later.

## Verification of one-sided samples

40 random one-sided records (20 Opus-only, 20 Codex-only primary) were checked mechanically: the cited file exists and the cited line is inside it. Result: {'pointer_ok': 40}. This checks the pointers, not whether the code is a real calculation; neither inventory's records were re-read semantically.

| Side | ID | Verdict | Line at pointer |
|---|---|---|---|
| opus | RNK-039 | pointer_ok | `web/lib/rankings/splits.ts:151: function buildRequest(` |
| opus | CARD-002 | pointer_ok | `web/lib/player-cards/interactionSnapshot.ts:20: const player = EXAMPLE_PLAYERS.find(player => player.id === card.selection.playerId)!;` |
| opus | PFC-108 | pointer_ok | `web/lib/player-forecasts/seasonGameContributions.ts:18: export function prepareSeasonGameContribution(artifact: PortableSeasonArtifact, binding: Seaso` |
| opus | ROLL-001 | pointer_ok | `web/lib/socialShare/trends.ts:185: const form = [...active].flatMap(([nhlId, { latest }]) => {` |
| opus | MISC-030 | pointer_ok | `web/lib/sources/tweetIdentityCandidates.ts:22: function boundedDistance(left: string, right: string, bound: number): number / null {` |
| opus | LINE-037 | pointer_ok | `web/lib/projections/ingest/shifts.ts:112: function strengthForTeam(` |
| opus | LINE-040 | pointer_ok | `web/lib/supabase/Upserts/nhlShiftStints.ts:84: export function normalizeShiftInterval(row: ShiftRow): NhlShiftInterval / null {` |
| opus | UST-023 | pointer_ok | `web/lib/underlying-stats/playerStatsLandingServer.ts:3420: function accumulateGoalieShotFeatureBucketMetrics(` |
| opus | LINE-042 | pointer_ok | `web/lib/rankings/teamUnitToiBuilder.ts:379: export function buildPowerPlayTeamUnitToiRows(args: {` |
| opus | CARD-015 | pointer_ok | `web/lib/homepagePulse.ts:155: export function buildHomepagePulsePoints(args: {` |
| opus | GPR-023 | pointer_ok | `web/lib/game-predictions/featureBuilder.ts:1550: function buildGoalieContextFeatures(args: {` |
| opus | SUS-010 | pointer_ok | `web/pages/trendsSandbox.tsx:115: const BAROMETER_MIN = -3;` |
| opus | PFC-125 | pointer_ok | `modeling/player_forecasts/season.py:3176: participation: dict[tuple[str, int], dict[int, dict[str, float]]] = defaultdict(` |
| opus | UST-093 | pointer_ok | `web/lib/NHL/TOI.ts:82: export function parseTime(timeString: string) {` |
| opus | SUS-035 | pointer_ok | `web/components/sustainability/formatting.ts:10: function quantile(sorted: number[], fraction: number) {` |
| opus | FSC-013 | pointer_ok | `web/pages/trendsSandbox.tsx:200: const FANTASY_WEIGHTS = {` |
| opus | MISC-010 | pointer_ok | `web/lib/socialShare/modules/teamGames.ts:45: export function buildTeamGames(input: { rows: readonly TeamGameInput[]; schedule: readonly TeamGamesSched` |
| opus | UST-066 | pointer_ok | `web/lib/underlying-stats/playerStatsLandingServer.ts:2328: function getPbpOnlyShotDangerBucket(shot: ReturnType<typeof buildShotFeatureRows>[number]) ` |
| opus | UST-077 | pointer_ok | `web/components/TeamLandingPage/goalieTrends.js:12: const processGoalieData = (goalieData, totalGames) => {` |
| opus | SKO-025 | pointer_ok | `web/pages/api/v1/ml/update-predictions-sko.ts:330: const sko = Number.isFinite(predPoints)` |
| codex | season-head-goalie_advanced_v5_primitive_targets-long_range_shots_against_goalie | pointer_ok | `web/lib/fantasy-projections/contracts.ts:124: "LONG_RANGE_SHOTS_AGAINST_GOALIE",` |
| codex | rolling-cf | pointer_ok | `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1577: key: "cf",` |
| codex | season-head-goalie_primitive_targets-losses_goalie | pointer_ok | `web/lib/fantasy-projections/contracts.ts:53: "LOSSES_GOALIE",` |
| codex | staged-head-proj_goals_es | pointer_ok | `web/lib/projections/stages/skater-stage.ts:3219: proj_goals_es: Number((goalsEs * teamHorizonTotalScalar).toFixed(3)),` |
| codex | season-head-skater_advanced_v5_primitive_targets-shot_attempts | pointer_ok | `web/lib/fantasy-projections/contracts.ts:99: "SHOT_ATTEMPTS",` |
| codex | season-head-skater_fantasy_v4_primitive_targets-empty_net_goals | pointer_ok | `web/lib/fantasy-projections/contracts.ts:81: "EMPTY_NET_GOALS",` |
| codex | web-lib-projections-stages-skater-stage-runpergameskaterstage | pointer_ok | `web/lib/projections/stages/skater-stage.ts:1331: export async function runPerGameSkaterStage(args: {` |
| codex | category-counts-measures | pointer_ok | `web/lib/socialShare/modules/shared/categoryCounts.ts:12: export const CATEGORIES: readonly CategoryDefinition[] = [` |
| codex | season-head-team_advanced_v5_targets-team_high_danger_shots_for | pointer_ok | `web/lib/fantasy-projections/contracts.ts:135: "TEAM_HIGH_DANGER_SHOTS_FOR",` |
| codex | season-head-skater_advanced_v5_primitive_targets-on_ice_unblocked_attempts_for | pointer_ok | `web/lib/fantasy-projections/contracts.ts:112: "ON_ICE_UNBLOCKED_ATTEMPTS_FOR",` |
| codex | season-head-team_advanced_v5_targets-team_shot_attempts_for | pointer_ok | `web/lib/fantasy-projections/contracts.ts:129: "TEAM_SHOT_ATTEMPTS_FOR",` |
| codex | web-lib-projections-uncertainty-countvariance | pointer_ok | `web/lib/projections/uncertainty.ts:802: export function countVariance(mean: number, alpha?: number / null): number {` |
| codex | rolling-shots | pointer_ok | `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1639: key: "shots",` |
| codex | rolling-blocks | pointer_ok | `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1651: key: "blocks",` |
| codex | season-head-skater_primitive_targets-games_played | pointer_ok | `web/lib/fantasy-projections/contracts.ts:27: "GAMES_PLAYED",` |
| codex | roster-draft-search-similarity | pointer_ok | `supabase/migrations/20260716112908_production_schema_baseline.sql:4373: CREATE FUNCTION public.search_fhfh_draft_players(p_query text, p_include_archi` |
| codex | roster-mock-selection-softmax | pointer_ok | `web/lib/mockDraft/engine.ts:367: config.tier === "pro" &&` |
| codex | season-head-skater_primitive_targets-blocked_shots | pointer_ok | `web/lib/fantasy-projections/contracts.ts:38: "BLOCKED_SHOTS",` |
| codex | season-head-skater_advanced_v5_primitive_targets-rebound_shots | pointer_ok | `web/lib/fantasy-projections/contracts.ts:108: "REBOUND_SHOTS",` |
| codex | roster-player-comparison-percentile | pointer_ok | `web/components/DraftDashboard/ComparePlayersModal.tsx:125: const { labels, rows, leftAvg, rightAvg } = useMemo(() => {` |

## Gaps and cautions (read before using the stats)

- **No semantic matching.** The same calculation described at different locations (for example a SQL view cited in the baseline migration by one list and in a later migration by the other, a formula cited at its caller vs its helper, or lines that drifted between d31dcb33f and 11e4192d3) is counted once on each side. Opus-only and Codex-only counts are therefore upper bounds on the real coverage wins; reconcile them first in each packet.
- **Conflicts are under-detected.** Only three rule types were applied, so the conflict count is a floor. Wording differences in formulas, inputs, windows and denominators were not compared.
- **Pairs are unconfirmed.** Proximity can link neighbouring but different functions; `codex_part_of_opus` can over-attach in large files.
- The taxonomy mapping (table below) is a judgement call for about 150 Codex labels; families with mixed content (social share, SQL cross-references) went to the nearest master family or Misc.
- Line references drift: both checkouts were shared and dirty.
- `web/scripts/blsh/*` is Codex-owned and is not inventoried by Opus; check Codex records there.

## Codex family → master family

| Codex family | Records | Master family |
|---|---:|---|
| BLSH forecast research | 5 | BLSH (Buy Low / Sell High) |
| BLSH interpretation | 3 | BLSH (Buy Low / Sell High) |
| BLSH research | 17 | BLSH (Buy Low / Sell High) |
| Baseline observed metric windows | 22 | Sustainability |
| CTPI | 8 | Team ratings / power / CTPI / SOS |
| Contextual skater rankings | 31 | Rankings |
| Deployment and usage | 3 | Lines / TOI / PP units |
| Draft SQL cross-reference | 1 | Draft tools |
| Draft ranking and discovery | 9 | Draft tools |
| Draft ranking operations | 4 | Draft tools |
| Expected goals | 29 | xG |
| FORGE SQL cross-reference | 1 | FORGE projections |
| FORGE SQL physical-event exposure | 1 | FORGE projections |
| FORGE SQL validation cross-reference | 1 | FORGE projections |
| FORGE context aggregation | 3 | FORGE projections |
| FORGE staged output metric | 10 | FORGE projections |
| FORGE staged projection math | 171 | FORGE projections |
| FORGE v2 conditional head | 7 | FORGE projections |
| FORGE v2 development kernel and ledger | 31 | FORGE projections |
| Fantasy scoring and display pacing | 2 | Fantasy scoring |
| Forecast diagnostics | 2 | Player forecasts (season) |
| GameGrid | 13 | Fantasy scoring |
| Goalie Category Counts | 8 | Misc / other |
| Goalie prior API arithmetic | 3 | Goalie starters & starter odds |
| Goalie rankings | 3 | Rankings |
| Goalie reader arithmetic | 1 | Goalie starters & starter odds |
| Illustrative SQL baseline | 1 | Misc / other |
| Legacy SQL Game Score | 1 | Underlying stats summaries |
| Legacy SQL SoS | 1 | Team ratings / power / CTPI / SOS |
| Legacy SQL aggregates | 2 | Underlying stats summaries |
| Legacy SQL goalie projections | 2 | Goalie starters & starter odds |
| Legacy SQL team power | 1 | Team ratings / power / CTPI / SOS |
| Legacy averages API | 2 | NST-derived stats |
| Legacy goalie projection SQL | 1 | Goalie starters & starter odds |
| Mock draft | 6 | Draft tools |
| Mock draft aggregate observations | 2 | Draft tools |
| NHL event context | 1 | xG |
| Native NST-parity metrics | 3 | Underlying stats summaries |
| Native coverage research | 1 | xG |
| Native game-expectation aggregates | 4 | xG |
| Native player forecasts and contribution serving | 36 | Player forecasts (season) |
| Native xG proxy cross-reference | 1 | xG |
| Offline fantasy analysis | 3 | Misc / other |
| Operational calculation helpers | 2 | Misc / other |
| Other product calculations | 7 | Misc / other |
| Planned metrics | 1 | Misc / other |
| Player forecast SQL cross-reference | 1 | Player forecasts (season) |
| Player forecast SQL runtime features | 16 | Player forecasts (season) |
| Player impact ratings | 3 | Rankings |
| Player-card analysis | 6 | Player cards & homepage stats |
| Player-card current NHL metrics | 2 | Player cards & homepage stats |
| Player-card population and windows | 2 | Player cards & homepage stats |
| Player-card proposed NST metrics | 12 | Player cards & homepage stats |
| Poisson chart | 1 | Game predictions & odds |
| Portable season fantasy projections | 14 | Player forecasts (season) |
| Power-play usage | 2 | Lines / TOI / PP units |
| Presentation arithmetic (not player metrics) | 2 | Misc / other |
| Projection evaluation | 3 | FORGE projections |
| Projection fitting and backtest scripts | 26 | FORGE projections |
| Python forecast research and season models | 101 | Player forecasts (season) |
| Rolling input math | 1 | Rolling player averages & trends |
| Rolling player metrics | 52 | Rolling player averages & trends |
| SKO/VuDu | 5 | sKO |
| SQL NST season aggregates | 4 | NST-derived stats |
| SQL PP context | 1 | Lines / TOI / PP units |
| SQL WGO derived rates | 1 | Underlying stats summaries |
| SQL game classification | 1 | Misc / other |
| SQL goalie weekly aggregates | 2 | Underlying stats summaries |
| SQL holistic team ratings | 2 | Team ratings / power / CTPI / SOS |
| SQL numeric helper | 1 | Stats helpers |
| SQL opponent-derived stats | 1 | FORGE projections |
| SQL player metric adapters | 1 | Underlying stats summaries |
| SQL player percentiles | 6 | Rankings |
| SQL team aggregates | 6 | Team ratings / power / CTPI / SOS |
| SQL team composites | 2 | Team ratings / power / CTPI / SOS |
| SQL team strength context | 1 | Team ratings / power / CTPI / SOS |
| SQL unified goalie aggregates | 1 | Underlying stats summaries |
| SQL unified player aggregates | 1 | Underlying stats summaries |
| SQL usage aggregates | 1 | Lines / TOI / PP units |
| Season forecast derived metric | 30 | Player forecasts (season) |
| Season forecast primitive: goalie | 17 | Player forecasts (season) |
| Season forecast primitive: skater | 54 | Player forecasts (season) |
| Season forecast primitive: team | 9 | Player forecasts (season) |
| Served forecast ledger evaluation | 3 | Player forecasts (season) |
| Shared projection math | 8 | FORGE projections |
| Shared ranking and display | 3 | Rankings |
| Sko Element | 7 | sKO |
| Social-share calculations | 7 | Misc / other |
| Statistical baseline windows | 9 | Sustainability |
| Sustainability SQL cross-reference | 1 | Sustainability |
| Team rankings | 3 | Team ratings / power / CTPI / SOS |
| Trade and roster autopsy | 3 | Trade value |
| Trade value qualification | 2 | Trade value |
| Underlying schedule | 2 | Fantasy scoring |
| Underlying statistics | 5 | Underlying stats summaries |
| Underlying team context | 2 | Underlying stats summaries |
| Underlying team dashboard | 2 | Underlying stats summaries |
| Underlying team narrative | 1 | Underlying stats summaries |
| WiGO ratings | 5 | WiGO |
| draft-display | 2 | Draft tools |
| draft-logistics | 2 | Draft tools |
| draft-pro | 4 | Draft tools |
| draft-projections | 8 | Draft tools |
| draft-recommendations | 7 | Draft tools |
| draft-schedule | 1 | Draft tools |
| draft-scoring | 5 | Draft tools |
| draft-summary | 12 | Draft tools |
| draft-value | 4 | Draft tools |
| game prediction evaluation | 10 | Game predictions & odds |
| game prediction features | 10 | Game predictions & odds |
| game prediction market | 2 | Game predictions & odds |
| game prediction model | 10 | Game predictions & odds |
| game prediction model feature | 53 | Game predictions & odds |
| game prediction recent form | 9 | Game predictions & odds |
| goalie value UI | 6 | Draft tools |
| goalie weekly | 3 | Underlying stats summaries |
| legacy SKO | 7 | sKO |
| legacy SKO SQL | 2 | sKO |
| legacy SKO prediction | 1 | sKO |
| legacy WGO averages | 4 | NST-derived stats |
| legacy game goals | 6 | Game predictions & odds |
| legacy performance research | 4 | Misc / other |
| legacy team aggregation | 4 | Team ratings / power / CTPI / SOS |
| player performance UI | 4 | Underlying stats summaries |
| player power trends | 5 | Team ratings / power / CTPI / SOS |
| player trend metric | 45 | Rolling player averages & trends |
| projection display | 1 | FORGE projections |
| recent team form candidate | 2 | Game predictions & odds |
| roster-forecast-bridge | 10 | RSO / roster optimizer |
| roster-planning | 23 | RSO / roster optimizer |
| roster-schedule | 8 | RSO / roster optimizer |
| sKO SQL cross-reference | 1 | sKO |
| skater value UI | 6 | Draft tools |
| standings display | 1 | Misc / other |
| strength of schedule | 4 | Team ratings / power / CTPI / SOS |
| sustainability Python legacy | 10 | Sustainability |
| sustainability band metric | 22 | Sustainability |
| sustainability bands | 10 | Sustainability |
| sustainability distribution | 2 | Sustainability |
| sustainability evaluation | 2 | Sustainability |
| sustainability features | 15 | Sustainability |
| sustainability model utilities | 8 | Sustainability |
| sustainability priors | 4 | Sustainability |
| sustainability window score | 3 | Sustainability |
| team percentile trends | 1 | Team ratings / power / CTPI / SOS |
| team performance UI | 2 | Team ratings / power / CTPI / SOS |
| team performance drivers | 3 | Team ratings / power / CTPI / SOS |
| team power | 19 | Team ratings / power / CTPI / SOS |
| timeline display | 1 | Misc / other |
| trends utilities | 6 | Rolling player averages & trends |
| weekScore | 3 | Fantasy scoring |
