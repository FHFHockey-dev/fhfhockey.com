# Frozen flag and direct/helper reader inventory

Pin `89da739cb45d7d572ed59bfa0b209c79c5d99299`. Exact source matches below; imports and declarations are included so the list does not hide a reader. Transitive rendered consumers remain in the canonical per-symbol ledger. No production env value was read.

| Flag | Frozen value / gate | Current production |
|---|---|---|
| `LEDGER_BASIS_SCHEMA_ENABLED` | true, compile-time | Unverified; code constants require the exact deployed SHA, env gates require their own value evidence. |
| `FORGE_RESERVE_PASS_ENABLED` | exact env string true enables; unset/default off | Unverified; code constants require the exact deployed SHA, env gates require their own value evidence. |
| `PP_STORED_CALCULATION_WRITES_ENABLED` | exact env string true enables non-dry-run writes; default off | Unverified; code constants require the exact deployed SHA, env gates require their own value evidence. |
| `PP_SHARE_SERVING_ENABLED` | exact env string true enables; default withheld | Unverified; code constants require the exact deployed SHA, env gates require their own value evidence. |
| `LEDGER_MARKET_ENABLED` | false, compile-time | Unverified; code constants require the exact deployed SHA, env gates require their own value evidence. |
| `DEFAULT_FORECAST_CALENDAR_VERSION` | forecast-calendar-v2, compile-time | Unverified; code constants require the exact deployed SHA, env gates require their own value evidence. |
| `STRENGTH_VERSION` | 2, compile-time | Unverified; code constants require the exact deployed SHA, env gates require their own value evidence. |

PP writes/serving were historically reported enabled and demonstrated by the retained #441/#442 operations. That does not prove current values. The source calendar v2 and ledger basis true supersede the early production queue wording that still said pending.

## LEDGER_BASIS_SCHEMA_ENABLED

```text
89da739cb:web/lib/player-forecasts/servedForecastLedger.ts:23:export const LEDGER_BASIS_SCHEMA_ENABLED = true;
89da739cb:web/pages/api/v1/db/forge-served-forecast-settle.ts:7:import { buildBoxscoreReceipts, LEDGER_BASIS_SCHEMA_ENABLED, LEDGER_SCORING_VERSION, LEDGER_UNIVERSE_TABLE, settleLedgerRows, settleLedgerUniverse,
89da739cb:web/pages/api/v1/db/forge-served-forecast-settle.ts:41:    const ledger = await pages(() => db.from(LEDGER_TABLE).select([...CARRIED_COLUMNS, "settled_at", ...(LEDGER_BASIS_SCHEMA_ENABLED ? ["forecast_basis"] : [])].join(","), { count: "exact" })
89da739cb:web/pages/api/v1/db/forge-served-forecast-settle.ts:83:    if (LEDGER_BASIS_SCHEMA_ENABLED) {
89da739cb:web/pages/api/v1/db/forge-served-forecast-snapshot.ts:8:import { buildLedgerRows, buildMarketLedgerRows, LEDGER_BASIS_SCHEMA_ENABLED, LEDGER_MARKET_ENABLED, LEDGER_SCORING_VERSION, LEDGER_SOURCES, LEDGER_UNIVERSE_TABLE,
89da739cb:web/pages/api/v1/db/forge-served-forecast-snapshot.ts:17: * Decision 41: once the L4a migration is applied (LEDGER_BASIS_SCHEMA_ENABLED) each row carries its declared basis and the
89da739cb:web/pages/api/v1/db/forge-served-forecast-snapshot.ts:112:    const stored = (list: LedgerRow[]) => LEDGER_BASIS_SCHEMA_ENABLED ? list : list.map(({ forecast_basis: _basis, ...row }) => row);
89da739cb:web/pages/api/v1/db/forge-served-forecast-snapshot.ts:118:    if (LEDGER_BASIS_SCHEMA_ENABLED) for (const batch of chunks(universe, UPSERT_BATCH)) {
89da739cb:web/pages/api/v1/db/forge-served-forecast-snapshot.ts:151:      coverageStatus: LEDGER_BASIS_SCHEMA_ENABLED ? "universe_persisted" : "unavailable_independent_universe_not_persisted",
89da739cb:web/pages/api/v1/forge/scoreboard.ts:8:import { LEDGER_BASIS_SCHEMA_ENABLED, LEDGER_MARKET_ENABLED, LEDGER_SCORING_LIMITATIONS, LEDGER_SCORING_VERSION, LEDGER_UNIVERSE_TABLE, scoreLedger, scoreMarketLedger,
89da739cb:web/pages/api/v1/forge/scoreboard.ts:46:      const query = db.from("forge_served_forecast_ledger").select(COLUMNS + (LEDGER_MARKET_ENABLED ? ",market_lines" : "") + (LEDGER_BASIS_SCHEMA_ENABLED ? ",forecast_basis" : ""), { count: "exact" })
89da739cb:web/pages/api/v1/forge/scoreboard.ts:61:    const universe = LEDGER_BASIS_SCHEMA_ENABLED ? await pages(() => {
```

## FORGE_RESERVE_PASS_ENABLED

```text
89da739cb:web/lib/projections/reserveProjections.ts:25:export function forgeReservePassEnabled(env: Readonly<Record<string, string | undefined>> = process.env): boolean {
89da739cb:web/lib/projections/reserveProjections.ts:26:  return env.FORGE_RESERVE_PASS_ENABLED === "true";
89da739cb:web/lib/projections/stages/goalie-stage.ts:80:import { buildReserveGoalieRow, forgeReservePassEnabled } from "../reserveProjections";
89da739cb:web/lib/projections/stages/goalie-stage.ts:898:    for (const goalieId of forgeReservePassEnabled() ? c.rosterGoalieIds ?? [] : []) {
89da739cb:web/lib/projections/stages/skater-stage.ts:17:import { buildReserveSkaterLine, buildReserveSkaterRow, forgeReservePassEnabled, selectReserveSkaters } from "lib/projections/reserveProjections";
89da739cb:web/lib/projections/stages/skater-stage.ts:3685:    const reservePassEnabled = forgeReservePassEnabled();
89da739cb:web/lib/rosterScheduleData/forgeDailyBridge.ts:7:import { forgeReservePassEnabled } from "lib/projections/reserveProjections";
89da739cb:web/lib/rosterScheduleData/forgeDailyBridge.ts:919:    forgeReservePassEnabled() ? timed("reserves", () => pages(() => db.from("forge_reserve_projections").select(RESERVE_COLUMNS, { count: "exact" }).in("run_id", runIds).eq("horizon_games", 1)
```

## PP_STORED_CALCULATION_WRITES_ENABLED

```text
89da739cb:web/pages/api/v1/db/update-power-play-combinations/[gameId].ts:31: * Writes stay off until TJ approves them (decision 152): unless PP_STORED_CALCULATION_WRITES_ENABLED is exactly
89da739cb:web/pages/api/v1/db/update-power-play-combinations/[gameId].ts:36:export function ppStoredCalculationWritesEnabled(): boolean {
89da739cb:web/pages/api/v1/db/update-power-play-combinations/[gameId].ts:37:  return process.env.PP_STORED_CALCULATION_WRITES_ENABLED === "true";
89da739cb:web/pages/api/v1/db/update-power-play-combinations/[gameId].ts:44:    message: 'Power-play stored-calculation writes are off (PP_STORED_CALCULATION_WRITES_ENABLED is not "true"); nothing was written.',
89da739cb:web/pages/api/v1/db/update-power-play-combinations/[gameId].ts:416:  if (options.dryRun !== true && !ppStoredCalculationWritesEnabled()) {
89da739cb:web/pages/api/v1/db/update-power-play-combinations/[gameId].ts:418:    throw new Error(`Writes are off (${PP_STORED_WRITES_DISABLED_REASON}); run with dryRun or set PP_STORED_CALCULATION_WRITES_ENABLED=true.`);
89da739cb:web/pages/api/v1/db/update-power-play-combinations/[gameId].ts:499:  if (!dryRun && !ppStoredCalculationWritesEnabled()) {
89da739cb:web/pages/api/v1/db/update-power-play-combinations/index.ts:9:  ppStoredCalculationWritesEnabled,
89da739cb:web/pages/api/v1/db/update-power-play-combinations/index.ts:140:  if (!dryRun && !ppStoredCalculationWritesEnabled()) {
```

## PP_SHARE_SERVING_ENABLED

```text
89da739cb:web/lib/ppShare/serving.ts:3: * unless PP_SHARE_SERVING_ENABLED is exactly "true", readers keep today's behaviour (PP share withheld).
89da739cb:web/lib/ppShare/serving.ts:16:export function ppShareServingEnabled(): boolean {
89da739cb:web/lib/ppShare/serving.ts:17:  return process.env.PP_SHARE_SERVING_ENABLED === "true";
89da739cb:web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:56:  ppShareServingEnabled,
89da739cb:web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:3253:  if (!ppShareServingEnabled()) return null;
89da739cb:web/lib/supabase/Upserts/rollingPlayerPpShareContract.ts:111: * Decision 152, with PP share served (PP_SHARE_SERVING_ENABLED): the stored team-game clock (pp_team_game_clock)
89da739cb:web/pages/api/toi.ts:12:  ppShareServingEnabled,
89da739cb:web/pages/api/toi.ts:66:   * Decision 152, present only while PP share is served (PP_SHARE_SERVING_ENABLED): whether this game's PP time
89da739cb:web/pages/api/toi.ts:140:    const serving = ppShareServingEnabled();
89da739cb:web/pages/api/v1/pp-share/team-game-clock.ts:5:  ppShareServingEnabled,
89da739cb:web/pages/api/v1/pp-share/team-game-clock.ts:12: * plus whether PP share serving is on (the server-side PP_SHARE_SERVING_ENABLED flag). With serving off it reads
89da739cb:web/pages/api/v1/pp-share/team-game-clock.ts:37:  if (!ppShareServingEnabled()) {
```

## LEDGER_MARKET_ENABLED

```text
89da739cb:web/lib/player-forecasts/servedForecastLedger.ts:199:export const LEDGER_MARKET_ENABLED = false;
89da739cb:web/pages/api/v1/db/forge-served-forecast-snapshot.ts:8:import { buildLedgerRows, buildMarketLedgerRows, LEDGER_BASIS_SCHEMA_ENABLED, LEDGER_MARKET_ENABLED, LEDGER_SCORING_VERSION, LEDGER_SOURCES, LEDGER_UNIVERSE_TABLE,
89da739cb:web/pages/api/v1/db/forge-served-forecast-snapshot.ts:16: * Task 6.3 (LEDGER_MARKET_ENABLED): adds `market` rows from the day's pre-game prices, upserted after the other sources.
89da739cb:web/pages/api/v1/db/forge-served-forecast-snapshot.ts:126:    if (LEDGER_MARKET_ENABLED) try {
89da739cb:web/pages/api/v1/forge/scoreboard.ts:8:import { LEDGER_BASIS_SCHEMA_ENABLED, LEDGER_MARKET_ENABLED, LEDGER_SCORING_LIMITATIONS, LEDGER_SCORING_VERSION, LEDGER_UNIVERSE_TABLE, scoreLedger, scoreMarketLedger,
89da739cb:web/pages/api/v1/forge/scoreboard.ts:46:      const query = db.from("forge_served_forecast_ledger").select(COLUMNS + (LEDGER_MARKET_ENABLED ? ",market_lines" : "") + (LEDGER_BASIS_SCHEMA_ENABLED ? ",forecast_basis" : ""), { count: "exact" })
89da739cb:web/pages/api/v1/forge/scoreboard.ts:74:        ...(LEDGER_MARKET_ENABLED ? { market: scoreMarketLedger(dayRows) } : {}) };
89da739cb:web/pages/api/v1/forge/scoreboard.ts:87:      marketStatus: LEDGER_MARKET_ENABLED ? "enabled" : "disabled_pending_market_fixes",
89da739cb:web/pages/api/v1/forge/scoreboard.ts:88:      ...(LEDGER_MARKET_ENABLED ? { pooledMarket: scoreMarketLedger(rows) } : {}),
```

## DEFAULT_FORECAST_CALENDAR_VERSION

```text
89da739cb:web/lib/player-forecasts/calendarCoverage.ts:7:import { forecastCalendarPolicy, forecastCalendarWindow, startMassExceedsOne } from "./contributions";
89da739cb:web/lib/player-forecasts/calendarCoverage.ts:206:  const policy = forecastCalendarPolicy(calendarDays);
89da739cb:web/lib/player-forecasts/contributions.ts:15:export const DEFAULT_FORECAST_CALENDAR_VERSION: ForecastCalendarVersion = "forecast-calendar-v2";
89da739cb:web/lib/player-forecasts/contributions.ts:24:export function forecastCalendarPolicy(calendarDays?: number): AnyForecastCalendarPolicy;
89da739cb:web/lib/player-forecasts/contributions.ts:25:export function forecastCalendarPolicy(calendarDays: number, version: "forecast-calendar-v1"): ForecastCalendarPolicyV1;
89da739cb:web/lib/player-forecasts/contributions.ts:26:export function forecastCalendarPolicy(calendarDays: number, version: "forecast-calendar-v2"): ForecastCalendarPolicyV2;
89da739cb:web/lib/player-forecasts/contributions.ts:27:export function forecastCalendarPolicy(calendarDays: number, version: ForecastCalendarVersion): AnyForecastCalendarPolicy;
89da739cb:web/lib/player-forecasts/contributions.ts:28:export function forecastCalendarPolicy(calendarDays = 14, version: ForecastCalendarVersion = DEFAULT_FORECAST_CALENDAR_VERSION): AnyForecastCalendarPolicy {
89da739cb:web/lib/player-forecasts/contributions.ts:47:export function forecastCalendarDate(instant: string | Date, policy: AnyForecastCalendarPolicy = forecastCalendarPolicy()): string | null {
89da739cb:web/lib/player-forecasts/contributions.ts:54:export function calendarLeadDay(scheduledAt: string, now: string, policy: AnyForecastCalendarPolicy = forecastCalendarPolicy(),
89da739cb:web/lib/player-forecasts/contributions.ts:337:  const calendarPolicy = input.calendarPolicy ?? (policyValid ? forecastCalendarPolicy(horizonDays) : undefined);
89da739cb:web/lib/player-forecasts/contributions.ts:342:  const lead = calendarLeadDay(game.scheduledAt, now, calendarPolicy ?? forecastCalendarPolicy(), game.scheduleDate);
89da739cb:web/lib/player-forecasts/evaluation.ts:5:import { calendarLeadDay, forecastCalendarPolicy, type AnyForecastCalendarPolicy } from "./contributions";
89da739cb:web/lib/player-forecasts/evaluation.ts:274:    const calendarLeadDays = calendarLeadDay(String(game.startTime), String(output.issued_at), args.calendarPolicy ?? forecastCalendarPolicy(), game.date);
89da739cb:web/lib/player-forecasts/evaluation.ts:416:        calendarLeadDays: calendarLeadDay(String(row.scheduled_start_at), String(row.issued_at), args.calendarPolicy ?? forecastCalendarPolicy(), game.date),
89da739cb:web/lib/player-forecasts/orchestration.ts:2:import { forecastCalendarPolicy } from "./contributions";
89da739cb:web/lib/player-forecasts/orchestration.ts:132:    calendarPolicy: forecastCalendarPolicy(days),
89da739cb:web/lib/player-forecasts/orchestration.ts:151:  const configuredPolicy = forecastCalendarPolicy(Number(environment.STARTER_BOARD_CALENDAR_HORIZON_DAYS ?? 14));
89da739cb:web/lib/player-forecasts/planningContributions.ts:1:import { calendarLeadDay, catalogParticipation, startMassExceedsOne, forecastCalendarPolicy, validForecastCalendarPolicy, resolveContribution, type ContributionGame, type ContributionParticipation, type ContributionSource } from "./contributions";
89da739cb:web/lib/player-forecasts/planningContributions.ts:51:  const calendarPolicy = snapshot.forecastManifest?.calendarPolicy ?? forecastCalendarPolicy();
89da739cb:web/lib/player-forecasts/schedule.ts:4:import { calendarLeadDay, forecastCalendarPolicy, type AnyForecastCalendarPolicy } from "./contributions";
89da739cb:web/lib/player-forecasts/schedule.ts:37:export const PLAYER_FORECAST_CALENDAR_HORIZON_DAYS = forecastCalendarPolicy().calendarDays;
89da739cb:web/lib/player-forecasts/schedule.ts:66:  const policy = forecastCalendarPolicy(days, args.calendarPolicy?.version ?? forecastCalendarPolicy().version);
89da739cb:web/lib/projections/consumerRevisionAdmission.ts:2:import { calendarLeadDay, forecastCalendarPolicy, validForecastCalendarPolicy, type AnyForecastCalendarPolicy, type ForecastCalendarPolicy } from "lib/player-forecasts/contributions";
89da739cb:web/lib/projections/consumerRevisionAdmission.ts:24:  calendarPolicy: AnyForecastCalendarPolicy = forecastCalendarPolicy(),
89da739cb:web/lib/projections/consumerRevisionAdmission.ts:214:  deadline = Date.now() + 2000, calendarPolicy: ForecastCalendarPolicy = forecastCalendarPolicy()) {
89da739cb:web/lib/rosterScheduleData/planning.ts:18:import { forecastCalendarPolicy } from "lib/player-forecasts/contributions";
89da739cb:web/lib/rosterScheduleData/planning.ts:89:  const calendarPolicy = forecastCalendarPolicy(Number(process.env.STARTER_BOARD_CALENDAR_HORIZON_DAYS ?? 14));
89da739cb:web/pages/api/v1/db/forge-served-forecast-snapshot.ts:7:import { forecastCalendarPolicy } from "lib/player-forecasts/contributions";
89da739cb:web/pages/api/v1/db/forge-served-forecast-snapshot.ts:65:    const bridge = await loadForgeDailyBridgeForecasts(db, identified, planning.games, now, seasonId, deadline, forecastCalendarPolicy(), undefined, bridgeTiming);
89da739cb:web/pages/api/v1/start-chart.ts:5:import { forecastCalendarPolicy } from "lib/player-forecasts/contributions";
89da739cb:web/pages/api/v1/start-chart.ts:1007:          forecastCalendarPolicy(Number(process.env.STARTER_BOARD_CALENDAR_HORIZON_DAYS ?? 14)));
```

## STRENGTH_VERSION

```text
89da739cb:web/lib/supabase/Upserts/nhlRawGamecenter.mjs:7:export const STRENGTH_VERSION = 2;
89da739cb:web/lib/supabase/Upserts/nhlRawGamecenter.mjs:13:    `parser:${PARSER_VERSION}|strength:${STRENGTH_VERSION}|materializer:${NORMALIZATION_MATERIALIZER_VERSION}`,
89da739cb:web/lib/supabase/Upserts/nhlRawGamecenter.mjs:727:      strength_version: STRENGTH_VERSION,
89da739cb:web/lib/supabase/Upserts/nhlRawGamecenter.mjs:1039:      row.strength_version !== STRENGTH_VERSION
89da739cb:web/lib/supabase/Upserts/nhlRawGamecenter.mjs:1074:    strengthVersion: STRENGTH_VERSION,
89da739cb:web/lib/xg/featureVersion.ts:27:export const CURRENT_XG_FEATURE_STRENGTH_VERSION =
89da739cb:web/lib/xg/featureVersion.ts:44:  if (args.strengthVersion !== CURRENT_XG_FEATURE_STRENGTH_VERSION) {
89da739cb:web/lib/xg/featureVersion.ts:46:      `xG feature version ${CURRENT_XG_FEATURE_VERSION} is built from PBP strength_version ${CURRENT_XG_FEATURE_STRENGTH_VERSION}, not ${args.strengthVersion}.`
89da739cb:web/pages/api/v1/db/update-nhl-xg-shot-features.ts:16:  CURRENT_XG_FEATURE_STRENGTH_VERSION,
89da739cb:web/pages/api/v1/db/update-nhl-xg-shot-features.ts:436:    CURRENT_XG_FEATURE_STRENGTH_VERSION
89da739cb:web/scripts/train-nhl-xg-baseline.ts:59:import { CURRENT_XG_FEATURE_STRENGTH_VERSION, CURRENT_XG_FEATURE_VERSION } from "../lib/xg/featureVersion";
89da739cb:web/scripts/train-nhl-xg-baseline.ts:639:    strengthVersion: Number(options.strengthVersion ?? CURRENT_XG_FEATURE_STRENGTH_VERSION),
```
