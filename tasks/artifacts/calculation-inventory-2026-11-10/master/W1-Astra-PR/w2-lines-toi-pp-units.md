# Independent peer review: Wave 2 lines, TOI and PP units

2026-11-11. Reviewed Fable's `audits/lines-toi-pp-units.md`, local commit `1ef2e55aefaad8d81986557d2a37427371554842`. Source inspection and offline execution used the shared `octoberBranch` checkout at `68d907dc2`; the principal application files below have no diff from the audited commit. No application edits, database access, provider requests, cron execution, deployment or Git publication. Only this review file was written.

## Decision

**Retain the core strength-clock, goalie-ratio and misleading-label findings. Do not implement the proposed repairs verbatim.** The audit distinguishes several useful populations, but its nominally sound replacement source and several acceptance tests need correction.

Most consequential additions and qualifications:

1. **The goalie card's SEASON is not season-to-date.** Its source query is already restricted to ten team games with line data. Fixing pooled ratios alone leaves both displayed windows wrong.
2. **The candidate 5v5 source can emit a duplicate-player trio as complete.** An actual-helper fixture produces `[101,101,102]` from overlapping, nonidentical shift rows. Exact-duplicate cleanup does not repair this.
3. **Home/away eligible-clock agreement is not a completeness oracle.** One-second fragments pass current completion. Conversely, healthy 4F/1D deployment can produce different eligible trio/pair clocks for the two teams.
4. **Five PP skater-seconds per team PP second is not a universal ceiling.** A true penalty advantage with the attacking goalie pulled can have six; OT 4v3 has four. Fable's 5.96-versus-4.97 is a reported producer discrepancy, not by itself a measured 20% error against truth.
5. **The suggested immediate PP-source swap requires coverage and zero semantics.** `powerPlayCombinations` intentionally omits zero-PP players and preserves some unproven stale rows. A matching numerator/denominator is necessary, not a completeness guarantee.

“Live” below means a current source-reachable serving path, **not an independently observed production response**. Every production magnitude in Fable remains its dated, unrerun sample. New magnitudes here are explicitly synthetic.

## 1. PP clock: repair the interval population before swapping readers

### What is independently confirmed

The three pipelines are genuinely different:

- **Penalty clock:** `web/utils/getPowerPlayBlocks.ts:317-328,335-372,433-478` simulates served penalties and ends eligible minors on goals. `web/components/LinemateMatrix/index.tsx:213-226` passes those blocks to `utilities.ts:28-76`; that helper intersects each player's half-open occupied seconds with team PP blocks. The writer computes team block duration separately at `web/pages/api/v1/db/update-power-play-combinations/[gameId].ts:141-155`, writes positive-TOI players selected at `LinemateMatrix/index.tsx:563-565`, and stores `PPTOI / teamPpToiSeconds` at `web/lib/supabase/Upserts/powerPlayCombinationMetrics.ts:55-64`.
- **FORGE clock:** `web/lib/projections/ingest/shifts.ts:112-123` compares raw skater counts, ignoring goalie digits. Its `:266-289` holds an event's situation until the next event. The stored shift totals become `toi_es_seconds`, `toi_pp_seconds`, `toi_pk_seconds` at `web/lib/projections/derived/buildStrengthTablesV2.ts:310-324`.
- **FORGE event counts:** the same strength-table builder classifies shots/goals/assists using `derived/situation.ts:38-54`, which adjusts for pulled goalies, at `buildStrengthTablesV2.ts:272-306`. Consequently **a single row can have PP counts and PP exposure from incompatible state definitions**. Replacing a UI numerator alone does not fix PP rates or projection features.

`web/pages/api/toi.ts:88-95,136-152` combines the FORGE player clock with NHL team clock, changes missing FORGE data into zero and caps share at 100. `TimeOnIceChart/TimeOnIceChart.tsx:116-119,218-223` consumes that share and fixes its axis at 100. This is a source-reachable defect, not merely a theoretical downstream dependency.

PowerPlayCombos adds another support mismatch: NHL appearance rows determine `games`, while nullable or absent FORGE rows contribute zero PP shots/seconds. A failed FORGE query is deliberately ignored at `web/components/PowerPlayCombos/PowerPlayCombos.tsx:471-503`. Healthy NHL counts with an unavailable strength source can therefore show fabricated zero PP exposure. Repair **per-head support and query-error handling**, not just the strength classifier.

### Corrections to Fable's magnitude and oracle

- Sample B's 5.96/4.97 ratio is about a 20% difference between two reported producers. Do not call it an isolated 6v5 effect, penalty-expiry effect or population error. The sample joins available FORGE rows, coalesces absent combination rows to zero, and excludes missing official team clocks. Coverage/selection are part of that comparison.
- **Reject the universal five-player ceiling and `sum(playerPP)/5 = teamPP` test.** Running the actual PP clock and overlap helper over a 120-second penalty block with four, five and six attacking skaters yielded 480, 600 and 720 player-seconds. Dividing by five gives 96, 120 and 144, while team clock remains 120. These represent 4v3, ordinary five-skater PP and six-skater PP exposure respectively; they are not three estimates of the clock.
- `1560` is an ordinary home extra-attacker 6v5 state, not proof of a power play. Use separate fixtures: `1560` with no penalty; `1460` with a home penalty advantage and pulled home goalie; `0551` when the shorthanded away side pulls its goalie. Specify penalty history, teams and event times, rather than “1560 and one minor.” This follows prior FORGE Part 1 PR1/PR2/D15 and owner decisions 24/59.
- Retain the stronger individual check: on the **same complete interval population**, a player's unioned PP seconds cannot exceed the team's PP clock. Fable's reported 77/316 player-over-team cases remain a useful alarm. They do not isolate the exact faulty layer or certify that every simulation row is correct.
- Sample A is useful agreement evidence, not proof that a backfill executed successfully or all 501 games are complete. Thirteen reported team-games are outside five seconds; nine exceed 60. Freeze/version and investigate discrepancies before promoting the simulation as a universally qualified oracle.

### Safe repair contract

Define PP clock as penalty-advantage interval union, keep manpower/net state separately, and use the **same interval version** for player exposure and event counts. For a complete fixture, sum player PP seconds equals the integral of actual attacking skater count over qualifying intervals; individual PP seconds lie in `[0, teamPP]`. ES/PP/PK/other partitions must reconcile without adding empty-net production twice. Penalty expiry, goal termination, coincidentals, stacked/double minors, OT transitions and shootout exclusion need independent fixtures. Copying only the event classifier does not reconstruct expiry boundaries.

Do not simply remove the share cap and publish impossible values. Preserve the raw discrepancy for diagnosis, withhold/flag inconsistent pairs, and update chart null/quality behavior together. The chart's fixed 100 axis would otherwise still hide overflow. A valid share is bounded; a clamp is not evidence it is valid.

**Sparse rows and retained history:** the writer deliberately writes no rows for a team with no PP (`[gameId].ts:209`), excludes zero-time skaters, and deletes missing old rows only when no PP is proven (`:233-257`; proof at `:38-69`). On incomplete input it can retain old positive rows. Therefore:

- Known no PP deployment with complete player/game evidence is a known zero numerator.
- Missing player/game coverage is unknown, not zero.
- Team PP clock zero makes share undefined/not applicable, even if player PP seconds are known zero.
- A retained unproven row needs provenance/coverage, not automatic admission as the corrected source.

Add a game/team completion/version contract or expose this uncertainty before the proposed `/api/toi` swap. A sparse row plus `pp_share_of_team` cannot establish all of these states on its own. Test complete no-PP games, complete non-PP skaters, missing shifts, retained stale rows, zero denominator, invalid clocks and trade-date team identity.

**Correct the reader map:** current rolling PP share uses combination data, falling back to **WGO**, at `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1130-1145` and `rollingPlayerPpShareContract.ts:65-97`. No direct FORGE-TOI fallback is established in that reader. Do not list it as proven FORGE contamination without tracing WGO's producer; do include it in the new sparse-zero/coverage contract. The stored FORGE rate/splits readers remain real dependencies (`web/lib/splits/splitsServer.ts:641,676-681,729-743`).

## 2. Goalie card: wrong ratios, wrong windows, wrong outcome population

**Retain D2 and extend it.** The query-to-card chain is:

1. `web/components/LineCombinations/utilities.ts:91-101` selects the latest **ten team games with line combinations**.
2. `:241-259` restricts goalie rows to those game IDs, even though it also filters season and orders dates correctly.
3. `:506-507` calls this `seasonStats` and slices it again for `last10GamesStats`; `:539-544` returns both.
4. `web/pages/lines/[abbreviation].tsx:380-388` serves the result; `:263-273,302-310` renders goalies. `GoalieCard.tsx:100,115` labels the two collections **LAST 10** and **SEASON**.

With unique per-goalie/game rows, both arrays contain at most ten entries and are identical. Neither is necessarily the goalie's last ten appearances: a backup may have played only twice in those ten team games. Neither is his season. This is independently source-confirmed and the helper returns identical aggregates for a ten-row fixture. Production frequency/magnitude was not measured.

**Ratios reproduced:** a 30-save/30-shot, 60-minute shutout plus 1-save/3-shot, ten-minute relief appearance returns `.6666667` SV% and `6.00` GAA. Correct pooled values are `31/33 = .9393939` and `2*3600/4200 = 1.7142857`. The defect is at `utilities.ts:519-528`, not the display rounding. A row skipped for absent `saveShotsAgainst` still contributes to `stats.length` and GP. Unknown outcomes produce a win at `:523`; an empty outcome map in the executed shutout fixture returns `1-0-0`.

The record source is **team result**, selected by team/game at `:548-559`, not the individual goalie's credited decision. Both starter and relief goalie can receive the same team win. The card's “No starts yet this season” branch (`GoalieCard.tsx:50-51,96-97`) has no actual-start input and operates on these truncated appearance statistics. It cannot establish that claim.

**Repair/test invariants:**

- Specify season-to-date and goalie-last-ten-appearances independently, or honestly label a team-game-window statistic. Obtain complete eligible rows for each, including relevant prior-team appearances if the chosen season metric is player-wide. Do not let line-data availability silently define the stats population.
- Sum saves and shots on the same valid rows; sum GA and TOI on the same valid rows. Zero shots means undefined SV%, not `.000`; zero TOI means undefined GAA. Do not drop valid zero-shot/positive-TOI appearances merely because SV% is undefined. Expose head-specific coverage when some fields are absent.
- Distinguish appearance, credited start, credited win/loss and team result. Owner clarification on the card's record remains reasonable; do not infer credited decisions from greatest TOI, ordering or team victory. Coordinate with the existing goalie-outcome owner.
- Null/invalid values must stay unavailable through `GoalieCard.tsx:107-109,122-124`, which currently uses `|| 0`. A backend null fix alone reappears as a display zero.
- Regression fixtures: eleven goalie appearances where the eleventh changes season but not last ten; two appearances in the last ten team games; trade; relief with no decision; missing outcome; a valid zero-shot stint; no appearances; missing one metric. Assert count/exposure identities and honest window labels, not “season equals last ten.”

## 3. The proposed 5v5 replacement needs admission and identity repairs first

### New conditional defect: overlapping shift rows become two skaters

`web/lib/rankings/teamUnitToiBuilder.ts:486-505` drops **exact** interval duplicates only. `:207-215,301-323` counts active shift rows rather than distinct players. `:327-344` carries repeated player IDs into the unit. The public `buildTeamUnitToiRows` wrapper (`:508-530`) does not merge nonidentical overlaps.

**Executed through that wrapper:** team 1 has players 101(C), 102(L), 104(D), 105(D), goalie 106 over `[0,120)`, plus a second 101 shift over `[30,90)`; opponent has a normal five-skater unit and goalie over `[0,120)`. During overlap, four distinct team-1 skaters are counted as five. Output is forward trio **`[101,101,102]`**, 180 pooled seconds / 60 clock seconds, `coverage_status="complete"`; the opponent is also assigned only that 60-second window. Exact duplicate cleanup is already present, so proposing another exact-row dedup does not fix this.

This is a fixture-confirmed defect in a live producer with **unmeasured source prevalence**, not proof that Fable's 320-game sample contains these records. Before adopting it as canonical line evidence, union half-open intervals per game/team/player/period, reconcile conflicting identity/position evidence, count distinct IDs, and enforce unique membership in every emitted unit. Duplicate/overlap representation must not alter occupied time; incompatible evidence needs a visible hold/partial status.

### Coverage: reject the proposed home/away tolerance alone

`teamUnitToiBuilder.ts:230-232` calls a positive-pool result complete unless an unclassified position exists. It does not prove full-game shift coverage or goalie presence. `:314-335` requires five counted skaters on both teams, then independently requires **3F+2D for the team being emitted**.

Actual-helper fixtures show:

- Removing team 1's goalie shift still emits 120 seconds of “complete” five-on-five units for both teams. Missing goalie evidence and true empty-net states are not distinguished. This is insufficient for the proposed conventional 5v5 replacement.
- Keeping only `[0,1)` of both teams' shifts emits four complete rows; `completeGameIds` returns that game as complete. Equal clocks can be equally incomplete.
- Complete 120-second evidence with team 1 using **4F+1D for the first minute**, then 3F+2D, yields team-1 eligible clock 60 and team-2 clock 120. Both legitimately have five skaters and goalies throughout. A 60-second gap is not by itself missing data.

Fable's 478-second maximum gap is a reported diagnostic to investigate, not proof of source loss. Compare common manpower/goalie-qualified clock first, then reconcile **each team's own** 3F+2D exclusions, unknown intervals and observed eligible units. Do not mandate equality of differently filtered eligible pools.

The completion path also has two definitions. The write-time helper requires top forward and defense units for two teams (`web/lib/rankings/teamUnitToiNightly.ts:47-60`), ignoring coverage. The **next-run loader** checks only top forward rows (`:113-135`), so patching the helper alone leaves incomplete games skipped forever. Its “completed games” input is date-based with no final-state predicate (`:98-108`). This is a repair dependency with the final-game/schedule contract, not permission to run a rebuild.

### Exact observed units are not disjoint lineup slots

Fable D3 correctly identifies all-strength greedy grouping at `LinemateMatrix/index.tsx:517-550`. However, `team_unit_toi` ranks **all observed trios/pairs** (`teamUnitToiBuilder.ts:234-260`); different trios can share one or two players. Taking its top four trios as four lineup slots can duplicate players and omit others. This replacement needs an explicit consumer contract: observed combinations with TOI, or a separately derived disjoint lineup assignment. Preserve both histories/version their meaning. Rankings currently consumes top observed-unit share (`web/lib/rankings/teamMatrix.ts:897-907`), not a four-line roster.

The minimum correct tests are unique individuals within each observed unit, order/overlap representation invariance, a separate coverage ledger, and no duplicates across slots **only for the disjoint-assignment output**. A universal first-line match rate is not a correctness test.

## 4. PP unit labels, denominators and dormant work

- **D4: retain “pivot heuristic,” qualify the fix.** Positive-time skaters are grouped around a PP-TOI pivot at `LinemateMatrix/index.tsx:555-609`. Groups contain **up to** five, not necessarily five when fewer participate. Stored unit 3 and a rendered PP3 already exist (`[gameId].ts:181-184`; `PowerPlayCombos.tsx:95,562-583`); “is a third unit ever shown?” is a current-behavior question already answered by code. Whether to change it is policy.
- A minimum-seconds/share threshold is a role-definition choice requiring validation. “Five seconds can never be PP2” is not a sound unconditional test: the entire team opportunity might be five seconds. Separate observed co-deployment from an inferred stable role, disclose the opportunity denominator, and test the chosen threshold's boundaries. `exactFivePpUnits.ts:213-231` excludes 4v3 and empty-net classes, so it is a qualified 5v4/5v3 research comparator, **not a universal PP clock or full-game PP-role oracle**.
- **PP label share is not PP clock share.** The SQL peer review already corrected D7: deployment tallies are conditional within player/season/game-type/deployment-group (`W1-Astra-PR/w2-1-sql-cross-cut.md`, C4). A PP1 label on all three observed PP-unit games can correctly have share 100% despite twenty appearances. Do not quietly change that to 15%; add/version a dressed-game measure only under an explicit contract. Incidental labels will affect both numerator and eligible group membership and must be coordinated with SQL consumers.
- **D5 retained, with matched populations.** `shift-charts.ts:930-959` divides all-strength overlap by game length; `DateRangeMatrix/fetchAggregatedData.ts:1206-1227` divides by own TOI or selected-window game length. Both are valid descriptive fractions with different names, not evidence that one must be replaced by the other. For `shared=300`, `ownA=900`, `ownB=600`, `game=3600`, results are 33.3% of A, 50% of B and 8.33% of game. Shared seconds are symmetric; own-TOI percentages generally are not. Do not assert symmetric percentages. Reconcile player/team/date/strength coverage before pooling.
- **D6 retained, dormant PP payload only.** The legacy PP algorithm is separate; the bounded source search found `web/lib/game-predictions/evaluation.ts:438-446` reading **scores** from `pp_timeframes`, not PP details. Therefore the PP payload is not shown to affect current user PP numbers. This is not proof the table or its writer can be stopped safely. Decouple/migrate score production first and inventory other external consumers before any retirement.
- **D7 inherited, dormant in the bounded source search.** Do not confuse player-seconds shares with team-clock shares; nominal .2 is not a universal bound, as already qualified by the SQL review. No new deployed-schema claim is made.
- **D8: separate arithmetic defects from policy.** Mixed timing clocks and completeness deserve their specific fixes; uncalibrated confidence, shading saturation or undocumented presentation weights are not automatically probabilities or statistical errors. No new evidence here qualifies an auto-publish threshold. Validate the actual claimed metric and reader behavior rather than replacing coefficients by preference.

## 5. Cross-owner implementation order and release invariants

| Owner/workstream | Required handoff before dependent changes | Acceptance evidence |
|---|---|---|
| NHL event/shift ingestion, NST, FORGE Part 1 | Versioned interval state with penalty history, distinct-player occupied intervals, net-state and OT conventions; update event counts and exposure together. Preserve legacy values as legacy. | Interval union/conservation; complete/unknown clock ledger; counts and seconds use identical eligibility; final all-situation totals retain credited non-shootout events. |
| PP combinations and lines UI | Adopt qualified source/version plus known-zero, unknown, no-opportunity and retained-row states. Preserve actual game team. | Writer-to-API-to-chart fixtures; no fabricated zero after query failure; impossible share withheld/flagged; no silent overflow cap. |
| FORGE/rolling/splits | Review count/exposure source pairs, not only output labels. Rolling's named fallback is WGO. Coordinate rebuild scope with existing persistence holds. | Per-head matched support, weighted count/exposure identities, final consumer selection tests; no retry/backfill inferred from this review. |
| Goalie outcomes and line cards | Agree credited decision versus team record; separate season and player-last-ten query scopes and actual start/appearance metadata. | Pooled ratios and window fixtures through final rendering; missing values remain missing. |
| Rankings `team_unit_toi` and nightly | Distinct-player overlap normalization, common-clock coverage with team-specific eligibility exclusions; both completion helper and loader use the same admitted version/status; schedule final-state rule. | Phantom-trio, missing-goalie, symmetric fragment, 4F/1D, incomplete prior snapshot and missing-pair retry fixtures; no current snapshot silently called repaired. |
| SQL deployment tallies / social / draft / RSO | Decide observed unit versus inferred role versus disjoint lineup; document conditional denominator before changing membership thresholds. | Existing conditional labels remain interpretable; optional dressed-game rates use explicit no-role/unknown buckets; no duplicated players in slot output. |
| Game prediction score reader | Identify/replace score dependency before stopping legacy `pp_timeframes` production. | Score evaluation remains available; PP payload retirement is separately authorized and reversible. |

No global deployment or backfill is implied. First freeze reviewed source contracts and offline fixtures, then plan bounded migration/recomputation and consumer cutover with the owners. Existing `nst_persistence_unconfirmed` holds must be reconciled before retry, as the Batch A/B/C contract requires.

## 6. Coverage, evidence limits and checks

This is a deep review of the PP-clock/denominator/goalie-card/line-replacement dependency chain, not a new count of 43 independently proven verdicts. Retain the scoped findings above for 008/009/011/012/019/020/021/022/031/033–038/041–043 and inherited SQL dispositions for 001/002/004/013. The remaining heuristic/presentation/event-attribution entries were not independently re-certified here. In particular, Fable explicitly did not re-derive 017/018/024/027; its zero-undetermined summary must not be read as completed source verification of those entries. The source descriptions may be correct, but they are not executed proof.

Read the Wave 2 prompt/packet, relevant TRIAGE/MASTER map, owner decisions (especially 7, 24, 59), Batch A/B/C rules, FORGE Part 1 PR1/PR2/D15, Part 2's count/exposure/final-output cautions, and SQL C4. No fresh query, backfill receipt, provider comparison, production flag, deployment state or rendered live UI was inspected. Fable's 501/316/320-team-game samples remain **reported**, not replicated. Source-reachable does not establish current production prevalence.

**Passed:** seven existing focused Vitest files, **104 tests**, with inert Supabase values, from `web/`:

```sh
NEXT_PUBLIC_SUPABASE_URL=https://unit-tests.supabase.invalid NEXT_PUBLIC_SUPABASE_PUBLIC_KEY=synthetic-public-key SUPABASE_SERVICE_ROLE_KEY=synthetic-service-role-key ./node_modules/.bin/vitest run lib/exactFivePp/exactFivePpUnits.test.ts lib/rankings/teamUnitToiBuilder.test.ts lib/rankings/teamUnitToiNightly.test.ts lib/supabase/Upserts/powerPlayCombinationMetrics.test.ts __tests__/pages/api/toi.test.ts __tests__/pages/api/v1/db/update-power-play-combinations-game.test.ts components/LineCombinations/__test__/utilities.test.ts --reporter=dot
```

Existing tests verify current behavior, including zero fallback and capping in `/api/toi`; their passing is not an endorsement of that contract. No full application suite, lint, typecheck or build was warranted for this documentation-only review.

**Executed new offline fixtures:** actual-source VM loading, rejecting all unlisted imports and replacing hook/network dependencies with throwing stubs. Principal results: 4/5/6-skater PP integrals; minor terminated after 45 seconds; missing goalie admitted; one-second fragment accepted complete; legitimate asymmetric eligible clocks; duplicate-player trio; pooled-goalie counterexample; unknown result becomes WIN; identical limited-window aggregates. The first harness attempt stopped before fixture execution because `hooks/useGoals` was absent from its import allowlist. After verifying its `20*60` constant, it was stubbed and the full run passed. That was a harness restriction, not an application failure or external call.

### Reproduce the principal new unit/coverage counterexamples without services or writes

Run from `web/`. These load the production builder and nightly helper, including exact-duplicate cleanup, not a hand-reimplemented approximation.

```sh
node <<'NODE'
const fs = require('fs'), vm = require('vm'), ts = require('typescript');
function load(file) {
  const m = { exports: {} };
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  vm.runInNewContext(js, { module: m, exports: m.exports,
    require: id => { throw Error('Unapproved import: ' + id); } }, { filename: file });
  return m.exports;
}
const b = load('lib/rankings/teamUnitToiBuilder.ts');
const n = load('lib/rankings/teamUnitToiNightly.ts');
const players = [1, 2].flatMap(t => ['C','L','R','D','D','G']
  .map((position, i) => ({ id: t * 100 + i + 1, position })));
const row = (id, start, end) => ({
  game_id: 1, season_id: 20262027, game_date: '2026-11-11',
  team_id: Math.floor(id / 100), team_abbrev: 'FIX', player_id: id,
  period: 1, start_seconds: start, end_seconds: end, duration_seconds: end - start
});
const build = (shifts, ps = players) => b.buildTeamUnitToiRows({
  shifts, players: ps, ppRows: [], season: 20262027, snapshotDate: '2026-11-11'
});
const show = rows => rows.filter(r => r.unit_type === 'forward_line').map(r => ({
  team: r.team_id, ids: r.player_ids, clock: r.unit_toi_seconds / 3,
  pool: r.team_unit_pool_toi_seconds / 3, coverage: r.coverage_status
}));
const base = players.map(p => row(p.id, 0, 120));
console.log('Missing goalie', show(build(base.filter(r => r.player_id !== 106))));
const fragment = build(base.map(r => ({ ...r, end_seconds: 1, duration_seconds: 1 })));
console.log('One-second fragments', show(fragment), [...n.completeGameIds(fragment)]);
const mixed = [
  ...base.filter(r => r.team_id === 2),
  ...base.filter(r => r.team_id === 1).map(r => ({ ...r, start_seconds: 60, duration_seconds: 60 })),
  ...[101,102,103,107,104,106].map(id => row(id, 0, 60))
];
console.log('Valid 4F/1D then 3F/2D', show(build(mixed, [...players, { id: 107, position: 'C' }])));
console.log('Overlap phantom trio', show(build([
  ...base.filter(r => r.player_id !== 103), row(101, 30, 90)
])));
NODE
```

The other principal fixture inputs are fully specified above. For goalie reproduction, transpile `components/LineCombinations/utilities.ts` with `exports.processGoalie=processGoalie` appended **in memory**, stub its imports, and call with `{playerId:1, playerName:'Fixture Goalie', game:{id}, saveShotsAgainst, savePctg, toi, goalsAgainst}` for `(id=1,'30/30',1,'60:00',0)` and `(id=2,'1/3',1/3,'10:00',2)`. Use outcomes `Map([[1,'WIN'],[2,'LOSS']])`, then an empty map for the unknown-result case. No app source modification or DB client initialization is needed.

Final review status: substantive findings and proposed fixes checked against source; new counterexamples executed; existing focused tests passed; only this review artifact changed by this task. No unresolved tooling blocker.
