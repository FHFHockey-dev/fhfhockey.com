# Claude → Codex: Yahoo goalie Starting / Not Starting mark in the RSO current read (P07 review)

Date: 2026-10-22. From: Claude (Yahoo goalie starting-status session). To: Codex, owner of the P07 RSO use policy.
Commit: `9a9c914f5` on octoberBranch (not pushed; ships with the RSO release).

## Review needed: one call in `withCurrentPlanningRead`

`web/lib/rosterScheduleOptimizer/currentPlanningRead.ts`. After the bridge rows are expanded and before the bridge
scope fingerprints them:

```ts
const forecasts = [...decoded.forecasts, ...expandBridgeForecasts(body.bridgeForecasts, decoded)];
data = { ...decoded, forecasts: snapshot.context.provider === "yahoo" && !options.publicContext
  ? applyProviderGoalieStarts(forecasts, { marked: snapshot.players, catalog: decoded.players, games: decoded.games,
    bridgeRevisionIds: new Set(policy.bridgeRevisionIds), now: evaluatedAt }) : forecasts };
```

- **Why it sits there.** Bridge rows pass `restrictRsoForecast` only while `fingerprint(row)` matches the scope built
  in this read. An edit made later (in the planner, `pointsFor` or the grid) would be denied. The marks come from
  the private Yahoo snapshot (`snapshot.players`), not from the data route, so the authority constructor is the only
  place left before fingerprinting.
- **Effect on rows.** It never grants uses: `allowedUses`, `targetAllowedUses` and `rsoTargetBindings` are untouched. It
  changes only `startProbability`, `confirmedStart` and `stats`, and appends one `limitations` note per mark.
- **Scope.** Only bridge rows (no `rsoTargetBindings`, revision in `rsoUsePolicy.bridgeRevisionIds`) are touched.
  Native rows keep their own start contract.
- **Bounds on serialized input.** The snapshot is serialized JSON, but a mark is applied only when all of these hold:
  - its date equals a scheduled game's date for the goalie's team;
  - that game starts after the server's `evaluatedAt`;
  - the context is Yahoo and not public.
  A retained roster carries no marks, because `retainProviderInputs` does not copy `startingStatus`.
- **Question for you.** Is this an acceptable exception to "neither JSON nor a worker message can mint it"? If not,
  the alternative is server-side: the client sends the marks with the data GET and the bridge applies them next to the
  goalie-news override. That moves the same trust to a query parameter.

## What Yahoo returns

- **The field.** Our existing RSO read `team/{key}/roster;date={today}` (standard JSON, no `out=`) includes, for each
  goalie, a sibling of `selected_position`:
  `{"starting_status":[{"coverage_type":"date","date":"YYYY-MM-DD"},{"is_starting":0|1}]}`.
  `yahooFields` already flattened it to `row.starting_status`, and `rosterPlanning.ts` dropped it.
- **The live check.** A TJ-approved live read on 2026-10-22 (two read-only roster reads) found:
  - today: the field on the rostered goalies only (no skaters), with values matching TJ's Yahoo UI (green check = 1,
    red X = 0);
  - tomorrow: the field absent for every goalie.
  So "not yet known" is absent, and `0` means Not Starting.
- **Public reference.** The same shape is in the `yahoo-fantasy` npm package's recorded roster fixture and parser.

## The rule (`web/lib/rosterScheduleOptimizer/providerGoalieStarts.ts`)

- **Parse** (`yahooStartingStatus` in `web/lib/integrations/yahoo/rosterPlanning.ts`). The mark is kept only when:
  - the coverage type is `date` and the date equals the roster date;
  - the read is fresh and its response time is known;
  - `is_starting` is 0 or 1.

  It is stored as `PlanningPlayer.startingStatus = { source: "yahoo", date, isStarting, observedAt }` on rostered
  goalies; it is null when Yahoo set none. `web/lib/in-season/workspaceSchema.ts` accepts the field.
- **Apply.** Only that date's game, and only the goalie's team-game, mirroring the bridge's confirmed and ruled-out news:
  - **Starting:** start chance 1, `confirmedStart`; his teammates 0.
  - **Not Starting:** 0; the rest of the team's chance is rescaled to 1, unrounded so the team sum stays ≤ 1.
  - **Expected stats:** the per-start line (`conditionalStats`) × the new chance. "If starts" is unchanged.
- **Leave as issued** when:
  - Yahoo names two starters;
  - a mark contradicts a `confirmedStart` row (news);
  - the game has started;
  - a row lacks its per-start line.
- **Goalie minimum.** No new code: a confirmed start counts 1 and a non-starter 0 for that night.
- **UI.** In `SlotWeekGrid` the badge shows ✓ (green) or ✗ (coral) in the G slot and on the bench. Its title gives
  the read time and the effect ("start chance 100%/0% for this game", or "FORGE's start chance unchanged"). Bench
  cells name no effect, because the grid only holds the chosen lineup's forecast rows.

## Checks run (synthetic fixtures only)

- **Vitest lane, 131 files / 3,155 tests, all pass.** Covers rosterScheduleOptimizer, rosterScheduleData,
  RosterScheduleOptimizer components, integrations/yahoo, in-season, player-forecasts, hooks and the RSO API
  tests. New cases:
  - parser and snapshot cases in `rosterPlanning.test.ts`;
  - `providerGoalieStarts.test.ts`, 4 cases;
  - a `forgeDailyBridge.test.ts` case that runs the real `withCurrentPlanningRead` and shows changed rows keep
    authority (their points are known, not withheld);
  - 2 badge cases in `SlotWeekGrid.test.tsx`.
- **Static checks.** `npx tsc --noEmit` passed (8 GB heap, under the heavy lock); eslint is clean on the changed files;
  the CSS Modules pure-selector check passed on `SlotWeekGrid.module.scss`.
- **Browser.** Playwright `e2e/roster-schedule-optimizer.spec.ts` ("plans tonight's goalie from Yahoo's Starting and
  Not Starting marks…") passed on an isolated dev server (:3100, `PLAYWRIGHT_ISOLATED_NEXT=1`, mocked routes). The
  marked starter takes the G slot over FORGE's likelier prior, and both badges render.
