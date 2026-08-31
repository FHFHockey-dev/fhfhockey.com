import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "contexts/AuthProviderContext";
import useCurrentSeason from "hooks/useCurrentSeason";
import {
  type ProcessedPlayer,
  type TableDataRow,
  useProcessedProjectionsData,
} from "hooks/useProcessedProjectionsData";
import { useVORPCalculations } from "hooks/useVORPCalculations";
import {
  createDefaultSourceControls,
  loadSourceControlPreferences,
} from "lib/draftDashboard/sourceControlPreferences";
import { PROJECTION_SOURCES_CONFIG } from "lib/projectionsConfig/projectionSourcesConfig";
import { DEFAULT_YAHOO_GAME_KEY } from "lib/rosterScheduleData/constants";
import {
  calculateCandidateDust,
  classifyDustRisk,
  evaluateRosterSchedule,
  expandActiveSlots,
  prepareTeamSchedule,
  rankAlternativeRecommendations,
  type ActiveSlotInstance,
  type AlternativeRecommendation,
  type CandidateDustEvaluation,
  type DailyAssignment,
  type OptimizerPlayer,
  type RosterPlayerStatus,
  type RosterEvaluation,
  type TeamScheduleGame,
} from "lib/rosterScheduleOptimizer";
import supabase from "lib/supabase";
import {
  createDefaultUserLeagueSettings,
  type RosterConfig,
  type UserLeagueSettings,
} from "lib/user-settings/defaults";
import { mapUserSettingsRowToLeagueSettings } from "lib/user-settings/mappers";

import styles from "./RosterScheduleOptimizer.module.scss";

const SCHEDULE_START_WEEK = 1;
const SCHEDULE_END_WEEK = 30;
const SCHEDULE_STALE_AFTER_MS = 36 * 60 * 60 * 1000;
const EMPTY_STYLES: Record<string, string> = {};
const NOOP = () => undefined;
const SLOT_ORDER = ["C", "LW", "RW", "FWD", "W", "D", "utility", "G", "bench"];

type ScheduleRow = {
  source_game_id: string | number;
  game_date: string;
  game_status: string;
  team_abbreviation: string;
  week: number;
};

type SchedulePayload = {
  gameKey: string;
  startWeek: number;
  endWeek: number;
  version: string;
  freshness: {
    latestFetchedAt: string | null;
    oldestFetchedAt: string | null;
    rowCount: number;
  };
  games: ScheduleRow[];
};

type ConnectedRosterState = {
  status: "idle" | "loading" | "ready" | "error";
  teamName: string | null;
  players: unknown[];
  error: string | null;
};

type ExplicitRosterIdentity = {
  nhlIds: string[];
  yahooIds: string[];
};

function isProcessedPlayer(row: TableDataRow): row is ProcessedPlayer {
  return !("type" in row && row.type === "summary");
}

function textValue(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function nestedTextValue(value: unknown, key: string): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return textValue((value as Record<string, unknown>)[key]);
}

function connectedRosterStatus(value: unknown): RosterPlayerStatus {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "active";
  }
  const player = value as Record<string, unknown>;
  const selectedPosition =
    textValue(player.selected_position) ??
    nestedTextValue(player.selected_position, "position") ??
    textValue(player.selectedPosition) ??
    nestedTextValue(player.selectedPosition, "position") ??
    textValue(player.roster_position) ??
    textValue(player.rosterPosition);
  const normalized = selectedPosition?.trim().toUpperCase() ?? "";
  if (["BN", "BE", "BENCH"].includes(normalized)) return "bench";
  if (["IR+", "IL+"].includes(normalized)) return "ir+";
  if (["IR", "IR-LT", "IL", "LTIR"].includes(normalized)) return "ir";
  if (normalized === "NA") return "na";
  return "active";
}

function explicitRosterIdentity(value: unknown): ExplicitRosterIdentity {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { nhlIds: [], yahooIds: [] };
  }
  const player = value as Record<string, unknown>;
  const nhlIds = [
    textValue(player.nhl_player_id),
  ].filter((id): id is string => Boolean(id));
  const yahooPlayerKey = textValue(player.player_key);
  const yahooIds = [
    textValue(player.yahoo_player_id),
    textValue(player.player_id),
    textValue(player.editorial_player_id),
    textValue(player.editorial_player_key),
    textValue(player.editorial_player_key)?.split(".").at(-1) ?? null,
    yahooPlayerKey,
    yahooPlayerKey?.split(".").at(-1) ?? null,
  ].filter((id): id is string => Boolean(id));
  return {
    nhlIds: Array.from(new Set(nhlIds)),
    yahooIds: Array.from(new Set(yahooIds)),
  };
}

function snapshotPlayers(value: unknown): unknown[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const players = (value as Record<string, unknown>).players;
  return Array.isArray(players) ? players : [];
}

function toOptimizerPlayer(player: ProcessedPlayer, comparableValue?: number): OptimizerPlayer {
  const projectedValue = comparableValue ?? player.fantasyPoints.projected ?? 0;
  return {
    id: String(player.playerId),
    name: player.fullName,
    teamAbbreviation: player.displayTeam,
    eligiblePositions:
      player.eligiblePositions?.length
        ? player.eligiblePositions
        : player.displayPosition,
    value: Number.isFinite(projectedValue) ? projectedValue : 0,
    available: true,
  };
}

function rosterPlayerIdsFromSnapshot(
  roster: readonly unknown[],
  players: readonly ProcessedPlayer[],
): {
  ids: string[];
  statuses: ReadonlyMap<string, RosterPlayerStatus>;
  unmatched: number;
} {
  const byNhlId = new Map(players.map((player) => [String(player.playerId), player]));
  const byYahooId = new Map<string, ProcessedPlayer>();
  for (const player of players) {
    const yahooId = textValue(player.yahooPlayerId);
    if (!yahooId) continue;
    byYahooId.set(yahooId, player);
    byYahooId.set(yahooId.split(".").at(-1) ?? yahooId, player);
  }

  const matched = new Set<string>();
  const statuses = new Map<string, RosterPlayerStatus>();
  let unmatched = 0;
  for (const entry of roster) {
    const identity = explicitRosterIdentity(entry);
    const player =
      identity.nhlIds.map((id) => byNhlId.get(id)).find(Boolean) ??
      identity.yahooIds.map((id) => byYahooId.get(id)).find(Boolean);
    if (player) {
      const playerId = String(player.playerId);
      matched.add(playerId);
      statuses.set(playerId, connectedRosterStatus(entry));
    } else unmatched += 1;
  }
  return { ids: Array.from(matched).sort(), statuses, unmatched };
}

function scheduleGames(rows: readonly ScheduleRow[]): TeamScheduleGame[] {
  return rows.map((row) => ({
    gameId: String(row.source_game_id),
    date: row.game_date,
    teamAbbreviation: row.team_abbreviation,
    yahooWeek: row.week,
    status: "scheduled",
  }));
}

function isScheduleStale(timestamp: string | null): boolean {
  if (!timestamp) return true;
  const parsed = Date.parse(timestamp);
  return !Number.isFinite(parsed) || Date.now() - parsed > SCHEDULE_STALE_AFTER_MS;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatSignedCount(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

function formatSignedPercent(value: number): string {
  const percentage = Math.round(value * 100);
  return percentage > 0 ? `+${percentage}%` : `${percentage}%`;
}

function formatValue(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function formatDate(value: string): string {
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function paretoFront(
  recommendations: readonly AlternativeRecommendation[],
): AlternativeRecommendation[] {
  return recommendations.filter(
    (candidate) =>
      !recommendations.some(
        (other) =>
          other.player.id !== candidate.player.id &&
          other.dustImprovement >= candidate.dustImprovement &&
          other.valueDifference >= candidate.valueDifference &&
          (other.dustImprovement > candidate.dustImprovement ||
            other.valueDifference > candidate.valueDifference),
      ),
  );
}

function SummaryCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className={styles.summaryCard}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function EmptyPanel({ children }: { children: React.ReactNode }) {
  return <div className={styles.emptyPanel}>{children}</div>;
}

function PlayerName({ player }: { player: OptimizerPlayer }) {
  return (
    <span className={styles.playerName}>
      <strong>{player.name ?? player.id}</strong>
      <small>
        {player.teamAbbreviation ?? "No team"} · {Array.isArray(player.eligiblePositions) ? player.eligiblePositions.join("/") : player.eligiblePositions ?? "No position"}
      </small>
    </span>
  );
}

function DailyHeatmap({
  activeSlots,
  daily,
  playersById,
}: {
  activeSlots: readonly ActiveSlotInstance[];
  daily: readonly DailyAssignment[];
  playersById: ReadonlyMap<string, OptimizerPlayer>;
}) {
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  if (daily.length === 0) return <EmptyPanel>No scheduled roster games in this horizon.</EmptyPanel>;
  return (
    <>
      <div className={styles.heatmap} aria-label="Daily roster congestion heatmap">
        {daily.map((day) => {
          const level = day.benchGames === 0 ? "clear" : day.benchGames <= 2 ? "busy" : "heavy";
          const expanded = expandedDate === day.date;
          return (
            <button
              key={day.date}
              type="button"
              className={`${styles.heatCell} ${styles[level]}`}
              aria-expanded={expanded}
              aria-controls={`optimizer-day-${day.date}`}
              onClick={() => setExpandedDate(expanded ? null : day.date)}
            >
              <span>{formatDate(day.date)}</span>
              <strong>{day.benchGames}</strong>
              <small>bench</small>
            </button>
          );
        })}
      </div>
      {expandedDate ? (
        <div id={`optimizer-day-${expandedDate}`} className={styles.dateDetails}>
          {daily
            .filter((day) => day.date === expandedDate)
            .map((day) => {
              const assignmentBySlot = new Map(
                day.assignments.map((assignment) => [
                  assignment.slotId,
                  assignment,
                ]),
              );
              return <div key={day.date}>
                <h3>{formatDate(day.date)} lineup details</h3>
                <p>
                  {day.startableGames} of {day.scheduledGames} games start; {day.benchGames} land on the bench.
                </p>
                <div className={styles.detailColumns}>
                  <div>
                    <h4>Active slots</h4>
                    <ul>
                      {activeSlots.map((slot) => {
                        const assignment = assignmentBySlot.get(slot.id);
                        return (
                          <li key={slot.id}>
                            {slot.id}: {assignment
                              ? playersById.get(assignment.playerId)?.name ??
                                assignment.playerName ??
                                assignment.playerId
                              : "Open"}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                  <div>
                    <h4>Benched</h4>
                    {day.benchedPlayerIds.length ? (
                      <ul>
                        {day.benchedPlayerIds.map((id) => (
                          <li key={id}>
                            {playersById.get(id)?.name ?? id}: no compatible
                            active slot remained after maximum matching.
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>None</p>
                    )}
                    {day.unresolvedPlayers.length ? (
                      <>
                        <h4>Unresolved</h4>
                        <ul>
                          {day.unresolvedPlayers.map((player) => (
                            <li key={player.playerId}>
                              {playersById.get(player.playerId)?.name ??
                                player.playerName ??
                                player.playerId}
                              : eligibility could not be normalized.
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>;
            })}
        </div>
      ) : null}
    </>
  );
}

export default function RosterScheduleOptimizer() {
  const { user, isLoading: authLoading } = useAuth();
  const currentSeason = useCurrentSeason();
  const defaults = useMemo(() => createDefaultUserLeagueSettings(), []);
  const [leagueSettings, setLeagueSettings] = useState<UserLeagueSettings>(defaults);
  const [settingsStatus, setSettingsStatus] = useState<"loading" | "ready" | "error">("loading");
  const [rosterConfig, setRosterConfig] = useState<RosterConfig>(defaults.rosterConfig);
  const [connectedRoster, setConnectedRoster] = useState<ConnectedRosterState>({
    status: "idle",
    teamName: null,
    players: [],
    error: null,
  });

  const sourcePreferences = useMemo(() => {
    const sourceDefaults = {
      skater: createDefaultSourceControls(PROJECTION_SOURCES_CONFIG, "skater"),
      goalie: createDefaultSourceControls(PROJECTION_SOURCES_CONFIG, "goalie"),
    };
    if (typeof window === "undefined") return { version: 4 as const, ...sourceDefaults };
    return loadSourceControlPreferences(sourceDefaults);
  }, []);

  useEffect(() => {
    let active = true;
    if (authLoading) return () => { active = false; };
    if (!user?.id) {
      setLeagueSettings(defaults);
      setRosterConfig(defaults.rosterConfig);
      setSettingsStatus("ready");
      setConnectedRoster({ status: "idle", teamName: null, players: [], error: null });
      return () => { active = false; };
    }

    setSettingsStatus("loading");
    void supabase
      .from("user_settings")
      .select("league_type, scoring_categories, goalie_scoring_categories, category_weights, roster_config, team_count, draft_order_type, ui_preferences, active_context")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(async ({ data, error }) => {
        if (!active) return;
        if (error) {
          setSettingsStatus("error");
          setLeagueSettings(defaults);
          setRosterConfig(defaults.rosterConfig);
          return;
        }
        const mapped = mapUserSettingsRowToLeagueSettings(data as never);
        setLeagueSettings(mapped);
        setRosterConfig(mapped.rosterConfig);
        setSettingsStatus("ready");

        const context = mapped.activeContext;
        if (context.provider !== "yahoo" || !context.external_team_id) {
          setConnectedRoster({ status: "idle", teamName: null, players: [], error: null });
          return;
        }
        setConnectedRoster({ status: "loading", teamName: null, players: [], error: null });
        const teamResult = await supabase
          .from("external_teams")
          .select("id, team_name, roster_snapshot")
          .eq("id", context.external_team_id)
          .eq("user_id", user.id)
          .eq("provider", "yahoo")
          .maybeSingle();
        if (!active) return;
        if (teamResult.error || !teamResult.data) {
          setConnectedRoster({
            status: "error",
            teamName: null,
            players: [],
            error: teamResult.error?.message ?? "The active Yahoo team is no longer available.",
          });
          return;
        }
        setConnectedRoster({
          status: "ready",
          teamName: teamResult.data.team_name,
          players: snapshotPlayers(teamResult.data.roster_snapshot),
          error: null,
        });
      });
    return () => { active = false; };
  }, [authLoading, defaults, user?.id]);

  const skaterData = useProcessedProjectionsData({
    activePlayerType: "skater",
    sourceControls: sourcePreferences.skater,
    yahooDraftMode: "ALL",
    fantasyPointSettings: leagueSettings.scoringCategories,
    supabaseClient: supabase,
    currentSeasonId: currentSeason?.seasonId ? String(currentSeason.seasonId) : undefined,
    styles: EMPTY_STYLES,
    showPerGameFantasyPoints: false,
    togglePerGameFantasyPoints: NOOP,
    teamCountForRoundSummaries: leagueSettings.teamCount,
  });
  const goalieData = useProcessedProjectionsData({
    activePlayerType: "goalie",
    sourceControls: sourcePreferences.goalie,
    yahooDraftMode: "ALL",
    fantasyPointSettings: leagueSettings.goalieScoringCategories,
    supabaseClient: supabase,
    currentSeasonId: currentSeason?.seasonId ? String(currentSeason.seasonId) : undefined,
    styles: EMPTY_STYLES,
    showPerGameFantasyPoints: false,
    togglePerGameFantasyPoints: NOOP,
    teamCountForRoundSummaries: leagueSettings.teamCount,
  });

  const projectedPlayers = useMemo(
    () => [...skaterData.processedPlayers, ...goalieData.processedPlayers].filter(isProcessedPlayer),
    [goalieData.processedPlayers, skaterData.processedPlayers],
  );
  const forwardGrouping = useMemo(
    () =>
      (rosterConfig.FWD ?? rosterConfig.F ?? 0) > 0 &&
      !["C", "LW", "RW"].some((position) => (rosterConfig[position] ?? 0) > 0)
        ? ("fwd" as const)
        : ("split" as const),
    [rosterConfig],
  );
  const { playerMetrics } = useVORPCalculations({
    players: projectedPlayers,
    availablePlayers: projectedPlayers,
    draftSettings: {
      teamCount: leagueSettings.teamCount,
      rosterConfig,
      leagueType: leagueSettings.leagueType,
      categoryWeights: leagueSettings.categoryWeights,
    },
    picksUntilNext: 0,
    leagueType: leagueSettings.leagueType,
    baselineMode: "full",
    categoryWeights: leagueSettings.categoryWeights,
    forwardGrouping,
    fantasyPointSettings: leagueSettings.scoringCategories,
  });
  const optimizerPlayers = useMemo(
    () => projectedPlayers.map((player) => toOptimizerPlayer(player, playerMetrics.get(String(player.playerId))?.value)),
    [playerMetrics, projectedPlayers],
  );
  const playersById = useMemo(() => new Map(optimizerPlayers.map((player) => [player.id, player])), [optimizerPlayers]);
  const connectedIdentity = useMemo(
    () => rosterPlayerIdsFromSnapshot(connectedRoster.players, projectedPlayers),
    [connectedRoster.players, projectedPlayers],
  );
  const baselineRosterIds = useMemo(
    () => connectedRoster.status === "ready" ? connectedIdentity.ids : [],
    [connectedIdentity.ids, connectedRoster.status],
  );
  const baselineSignature = baselineRosterIds.join("|");
  const [scenarioRosterIds, setScenarioRosterIds] = useState<string[]>([]);
  const [initializedBaseline, setInitializedBaseline] = useState<string | null>(null);
  useEffect(() => {
    if (initializedBaseline === baselineSignature) return;
    setScenarioRosterIds(baselineRosterIds);
    setInitializedBaseline(baselineSignature);
  }, [baselineRosterIds, baselineSignature, initializedBaseline]);

  const [gameKey, setGameKey] = useState<string>(DEFAULT_YAHOO_GAME_KEY);
  const [gameKeyInput, setGameKeyInput] = useState<string>(
    DEFAULT_YAHOO_GAME_KEY,
  );
  const [gameKeyError, setGameKeyError] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<SchedulePayload | null>(null);
  const [scheduleStatus, setScheduleStatus] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const loadSchedule = useCallback(async () => {
    setScheduleStatus("loading");
    setScheduleError(null);
    try {
      const query = new URLSearchParams({
        gameKey,
        startWeek: String(SCHEDULE_START_WEEK),
        endWeek: String(SCHEDULE_END_WEEK),
      });
      const response = await fetch(`/api/v1/roster-schedule-optimizer/schedule?${query}`);
      const payload = await response.json();
      if (!response.ok || payload?.success !== true) {
        throw new Error(payload?.error?.message ?? "Unable to load the NHL schedule.");
      }
      const next = payload.data as SchedulePayload;
      setSchedule(next);
      setScheduleStatus(next.games.length ? "ready" : "empty");
    } catch (error) {
      setSchedule(null);
      setScheduleStatus("error");
      setScheduleError(error instanceof Error ? error.message : "Unable to load the NHL schedule.");
    }
  }, [gameKey]);
  useEffect(() => { void loadSchedule(); }, [loadSchedule]);

  const availableWeeks = useMemo(
    () => Array.from(new Set((schedule?.games ?? []).map((game) => game.week))).sort((a, b) => a - b),
    [schedule?.games],
  );
  const firstWeek = availableWeeks[0] ?? SCHEDULE_START_WEEK;
  const lastWeek = availableWeeks.at(-1) ?? SCHEDULE_END_WEEK;
  const [startWeek, setStartWeek] = useState(SCHEDULE_START_WEEK);
  const [endWeek, setEndWeek] = useState(SCHEDULE_END_WEEK);
  useEffect(() => {
    if (!availableWeeks.length) return;
    setStartWeek((week) => Math.max(firstWeek, Math.min(week, lastWeek)));
    setEndWeek((week) => Math.max(firstWeek, Math.min(week, lastWeek)));
  }, [availableWeeks.length, firstWeek, lastWeek]);
  const selectedWeeks = useMemo(
    () => availableWeeks.filter((week) => week >= Math.min(startWeek, endWeek) && week <= Math.max(startWeek, endWeek)),
    [availableWeeks, endWeek, startWeek],
  );
  const fullSeason = startWeek === firstWeek && endWeek === lastWeek;
  const preparedSchedule = useMemo(
    () => prepareTeamSchedule(scheduleGames(schedule?.games ?? []), {
      gameKey,
      selectedWeeks,
    }),
    [gameKey, schedule?.games, selectedWeeks],
  );
  const activeSlots = useMemo(
    () => expandActiveSlots(rosterConfig).activeSlots,
    [rosterConfig],
  );
  const baselineRoster = useMemo<OptimizerPlayer[]>(
    () =>
      baselineRosterIds
        .map((id) => {
          const player = playersById.get(id);
          return player
            ? { ...player, status: connectedIdentity.statuses.get(id) }
            : null;
        })
        .filter(
          (player): player is NonNullable<typeof player> => player !== null,
        ),
    [baselineRosterIds, connectedIdentity.statuses, playersById],
  );
  const scenarioRoster = useMemo<OptimizerPlayer[]>(
    () =>
      scenarioRosterIds
        .map((id) => {
          const player = playersById.get(id);
          return player
            ? {
                ...player,
                status: baselineRosterIds.includes(id)
                  ? connectedIdentity.statuses.get(id)
                  : undefined,
              }
            : null;
        })
        .filter(
          (player): player is NonNullable<typeof player> => player !== null,
        ),
    [baselineRosterIds, connectedIdentity.statuses, playersById, scenarioRosterIds],
  );
  const baselineEvaluation = useMemo<RosterEvaluation | null>(() => {
    if (scheduleStatus !== "ready") return null;
    return evaluateRosterSchedule({
      roster: baselineRoster,
      rosterSlots: rosterConfig,
      schedule: preparedSchedule,
    });
  }, [baselineRoster, preparedSchedule, rosterConfig, scheduleStatus]);
  const evaluation = useMemo<RosterEvaluation | null>(() => {
    if (scheduleStatus !== "ready") return null;
    return evaluateRosterSchedule({ roster: scenarioRoster, rosterSlots: rosterConfig, schedule: preparedSchedule });
  }, [preparedSchedule, rosterConfig, scenarioRoster, scheduleStatus]);

  const playerDust = useMemo(() => {
    const dust = new Map<string, CandidateDustEvaluation>();
    if (scheduleStatus !== "ready") return dust;
    for (const player of scenarioRoster) {
      if (!["active", "bench"].includes(player.status ?? "active")) continue;
      const without = scenarioRoster.filter((entry) => entry.id !== player.id);
      const input = { roster: without, rosterSlots: rosterConfig, schedule: preparedSchedule };
      const baseline = evaluateRosterSchedule(input);
      const result = calculateCandidateDust(input, player, baseline);
      if (!result.diagnostics.some((item) => item.severity === "error")) {
        dust.set(player.id, result);
      }
    }
    return dust;
  }, [preparedSchedule, rosterConfig, scenarioRoster, scheduleStatus]);

  const [playerSearch, setPlayerSearch] = useState("");
  const availablePlayers = useMemo(() => {
    const rosterIds = new Set(scenarioRosterIds);
    const query = playerSearch.trim().toLocaleLowerCase();
    return optimizerPlayers
      .filter((player) => !rosterIds.has(player.id) && (!query || (player.name ?? "").toLocaleLowerCase().includes(query) || (player.teamAbbreviation ?? "").toLocaleLowerCase().includes(query)))
      .sort((left, right) => right.value - left.value || (left.name ?? left.id).localeCompare(right.name ?? right.id))
      .slice(0, 12);
  }, [optimizerPlayers, playerSearch, scenarioRosterIds]);
  const [selectedOutgoingId, setSelectedOutgoingId] = useState<string>("");
  useEffect(() => {
    if (selectedOutgoingId && scenarioRosterIds.includes(selectedOutgoingId)) return;
    setSelectedOutgoingId(playerDust.size ? [...playerDust.entries()].sort((a, b) => b[1].marginalDustGames - a[1].marginalDustGames)[0]?.[0] ?? "" : "");
  }, [playerDust, scenarioRosterIds, selectedOutgoingId]);
  const alternatives = useMemo(() => {
    const outgoing = playersById.get(selectedOutgoingId);
    if (!outgoing || scheduleStatus !== "ready") return [];
    const without = scenarioRoster.filter((player) => player.id !== outgoing.id);
    const input = { roster: without, rosterSlots: rosterConfig, schedule: preparedSchedule };
    const baseline = evaluateRosterSchedule(input);
    const outgoingDust = calculateCandidateDust(input, outgoing, baseline);
    if (outgoingDust.diagnostics.some((item) => item.severity === "error")) {
      return [];
    }
    const rosterIds = new Set(scenarioRosterIds);
    const candidateDust = optimizerPlayers
      .filter((player) => !rosterIds.has(player.id) && player.teamAbbreviation && player.eligiblePositions)
      .map((player) => calculateCandidateDust(input, player, baseline))
      .filter(
        (candidate) =>
          !candidate.diagnostics.some((item) => item.severity === "error"),
      );
    const ranked = rankAlternativeRecommendations(outgoingDust, candidateDust, rosterConfig);
    return paretoFront(ranked).slice(0, 8);
  }, [optimizerPlayers, playersById, preparedSchedule, rosterConfig, scenarioRoster, scenarioRosterIds, scheduleStatus, selectedOutgoingId]);

  const projectionLoading = skaterData.isLoading || goalieData.isLoading;
  const projectionError = skaterData.error || goalieData.error;
  const rosterSourceLabel = connectedRoster.status === "ready"
    ? `Connected Yahoo roster · ${connectedRoster.teamName ?? "Active team"}`
    : "Manual scenario · League Defaults";
  const scheduleStale = isScheduleStale(schedule?.freshness.latestFetchedAt ?? null);

  const addPlayer = (id: string) => {
    setScenarioRosterIds((current) => current.includes(id) ? current : [...current, id]);
    setPlayerSearch("");
  };
  const removePlayer = (id: string) => setScenarioRosterIds((current) => current.filter((entry) => entry !== id));
  const swapPlayer = (outgoingId: string, incomingId: string) => {
    setScenarioRosterIds((current) => current.map((id) => id === outgoingId ? incomingId : id));
    setSelectedOutgoingId(incomingId);
  };
  const applyGameKey = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextGameKey = gameKeyInput.trim();
    if (!/^[A-Za-z0-9._-]{1,40}$/.test(nextGameKey)) {
      setGameKeyError(
        "Yahoo game key must contain 1–40 letters, numbers, dots, underscores, or hyphens.",
      );
      return;
    }
    setGameKeyError(null);
    setGameKey(nextGameKey);
  };

  return (
    <main className={styles.optimizer}>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Schedule intelligence · Yahoo game {gameKey}</p>
          <h1>Roster Schedule Optimizer</h1>
          <p>Model the games your lineup can actually start—not just the games on the schedule.</p>
        </div>
        <div className={styles.sourceBadge}>
          <strong>{rosterSourceLabel}</strong>
          <span>Scenario changes stay local and never update your connected roster.</span>
        </div>
      </header>

      <section className={styles.controlGrid} aria-label="Optimizer controls">
        <article className={styles.panel}>
          <div className={styles.panelHeading}>
            <div><span className={styles.step}>01</span><h2>Lineup capacity</h2></div>
            <span className={styles.statusText}>{settingsStatus === "ready" ? leagueSettings.leagueType : settingsStatus}</span>
          </div>
          <div className={styles.slotGrid}>
            {SLOT_ORDER.map((slot) => (
              <label key={slot}>
                <span>{slot === "utility" ? "UTIL" : slot === "bench" ? "BN" : slot}</span>
                <input
                  type="number"
                  min="0"
                  max="20"
                  value={rosterConfig[slot] ?? 0}
                  onChange={(event) => setRosterConfig((current) => ({ ...current, [slot]: Math.max(0, Number.parseInt(event.target.value || "0", 10) || 0) }))}
                />
              </label>
            ))}
          </div>
          <p className={styles.assumption}>
            Daily lineup changes · {activeSlots.length} active slots ·{" "}
            {rosterConfig.bench ?? rosterConfig.BN ?? 0} bench spots. Weekly-lock
            leagues are not yet supported.
          </p>
          {settingsStatus === "error" ? <p className={styles.warning}>League settings could not be loaded; current FHFH defaults are in use.</p> : null}
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeading}>
            <div><span className={styles.step}>02</span><h2>Matchup horizon</h2></div>
            <span className={styles.statusText}>{fullSeason ? "Full season" : `${selectedWeeks.length} weeks`}</span>
          </div>
          <form className={styles.gameKeyControl} onSubmit={applyGameKey}>
            <label htmlFor="optimizer-game-key">Yahoo game key</label>
            <input
              id="optimizer-game-key"
              value={gameKeyInput}
              onChange={(event) => setGameKeyInput(event.target.value)}
              aria-describedby={gameKeyError ? "optimizer-game-key-error" : undefined}
            />
            <button type="submit" disabled={gameKeyInput.trim() === gameKey}>
              Load game
            </button>
          </form>
          {gameKeyError ? (
            <p id="optimizer-game-key-error" role="alert" className={styles.warning}>
              {gameKeyError}
            </p>
          ) : null}
          {scheduleStatus === "loading" ? <p role="status">Loading the NHL team-game schedule…</p> : null}
          {scheduleStatus === "error" ? (
            <div role="alert" className={styles.errorState}>
              <p>{scheduleError}</p><button type="button" onClick={() => void loadSchedule()}>Retry schedule</button>
            </div>
          ) : null}
          {scheduleStatus === "empty" ? <p role="status">No schedule rows are available for Yahoo game {gameKey}.</p> : null}
          {scheduleStatus === "ready" ? (
            <>
              <div className={styles.weekControls}>
                <label>Start week<select value={startWeek} onChange={(event) => setStartWeek(Number(event.target.value))}>{availableWeeks.map((week) => <option key={week} value={week}>Week {week}</option>)}</select></label>
                <label>End week<select value={endWeek} onChange={(event) => setEndWeek(Number(event.target.value))}>{availableWeeks.map((week) => <option key={week} value={week}>Week {week}</option>)}</select></label>
                <button type="button" onClick={() => { setStartWeek(firstWeek); setEndWeek(lastWeek); }}>Full season</button>
              </div>
              <p className={scheduleStale ? styles.warning : styles.freshness} role={scheduleStale ? "alert" : "status"}>
                {scheduleStale ? "Schedule cache may be stale" : "Schedule cache is current"} · {schedule?.freshness.latestFetchedAt ? `updated ${new Date(schedule.freshness.latestFetchedAt).toLocaleString()}` : "freshness unavailable"} · {schedule?.freshness.rowCount ?? 0} team-games
              </p>
            </>
          ) : null}
        </article>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeading}>
          <div><span className={styles.step}>03</span><h2>Scenario roster</h2></div>
          <button className={styles.secondaryButton} type="button" onClick={() => setScenarioRosterIds(baselineRosterIds)}>Reset scenario</button>
        </div>
        {connectedRoster.status === "loading" || projectionLoading ? <p role="status">Loading roster identities and projections…</p> : null}
        {connectedRoster.error ? <p role="alert" className={styles.warning}>{connectedRoster.error} Manual scenario controls remain available.</p> : null}
        {connectedIdentity.unmatched > 0 ? <p className={styles.warning}>{connectedIdentity.unmatched} connected roster {connectedIdentity.unmatched === 1 ? "player was" : "players were"} not matched by explicit Yahoo/NHL ID and are excluded. Names are never used for identity matching.</p> : null}
        {projectionError ? <p role="alert" className={styles.warning}>Some projections could not load: {projectionError}</p> : null}
        <div className={styles.addPlayer}>
          <label htmlFor="optimizer-player-search">Add a projected player</label>
          <input id="optimizer-player-search" type="search" value={playerSearch} onChange={(event) => setPlayerSearch(event.target.value)} placeholder="Search player or team" />
          {playerSearch ? (
            <ul className={styles.searchResults} aria-label="Projected player search results">
              {availablePlayers.map((player) => (
                <li key={player.id}><PlayerName player={player} /><button type="button" onClick={() => addPlayer(player.id)}>Add</button></li>
              ))}
              {!availablePlayers.length ? <li>No matching available players.</li> : null}
            </ul>
          ) : null}
        </div>

        {scenarioRoster.length ? (
          <div className={styles.tableScroll}>
            <table>
              <caption>Scenario roster and player-level DUST</caption>
              <thead><tr><th>Player</th><th>Value</th><th>Scheduled</th><th>Startable</th><th>Bench Games</th><th>DUST</th><th><span className={styles.srOnly}>Actions</span></th></tr></thead>
              <tbody>
                {scenarioRoster.map((player) => {
                  const summary = evaluation?.players.find((entry) => entry.playerId === player.id);
                  const dust = playerDust.get(player.id);
                  const risk = dust ? classifyDustRisk(dust.marginalDustGames, dust.candidateScheduledGames) : null;
                  return (
                    <tr key={player.id}>
                      <td><PlayerName player={player} /></td>
                      <td>{formatValue(player.value)}</td>
                      <td>{summary?.scheduledGames ?? 0}</td>
                      <td>{summary?.startableGames ?? 0}</td>
                      <td>{summary?.benchGames ?? 0}</td>
                      <td><span className={`${styles.riskBadge} ${risk ? styles[risk.label] : ""}`} aria-label={risk ? `${risk.label} DUST risk` : "DUST pending"}>{dust?.marginalDustGames ?? "—"}</span></td>
                      <td><button className={styles.textButton} type="button" onClick={() => removePlayer(player.id)} aria-label={`Remove ${player.name ?? player.id} from scenario`}>Remove</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <EmptyPanel>Add players to build a manual scenario, or select a connected Yahoo team in League Defaults.</EmptyPanel>}
      </section>

      {evaluation ? (
        <>
          <section className={styles.summaryGrid} aria-label="Scenario summary">
            <SummaryCard label="Scheduled" value={String(evaluation.totalScheduledGames)} detail="roster team-games" />
            <SummaryCard label="Startable" value={String(evaluation.totalStartableGames)} detail="games assigned to active slots" />
            <SummaryCard label="Bench Games" value={String(evaluation.totalBenchGames)} detail="schedule volume you cannot use" />
            <SummaryCard label="DUST" value={formatPercent(evaluation.dustRate)} detail="bench games ÷ scheduled games" />
            <SummaryCard label="Utilization" value={formatPercent(evaluation.activeSlotUtilization)} detail="active-slot capacity used" />
          </section>

          {baselineEvaluation ? (
            <section className={styles.comparisonPanel} aria-label="Scenario comparison">
              <div>
                <span className={styles.eyebrow}>Scenario vs connected/default baseline</span>
                <strong>
                  {formatSignedCount(
                    evaluation.totalBenchGames -
                      baselineEvaluation.totalBenchGames,
                  )}{" "}
                  Bench Games
                </strong>
              </div>
              <dl>
                <div>
                  <dt>Scheduled</dt>
                  <dd>{formatSignedCount(evaluation.totalScheduledGames - baselineEvaluation.totalScheduledGames)}</dd>
                </div>
                <div>
                  <dt>Startable</dt>
                  <dd>{formatSignedCount(evaluation.totalStartableGames - baselineEvaluation.totalStartableGames)}</dd>
                </div>
                <div>
                  <dt>DUST rate</dt>
                  <dd>{formatSignedPercent(evaluation.dustRate - baselineEvaluation.dustRate)}</dd>
                </div>
              </dl>
            </section>
          ) : null}

          {evaluation.diagnostics.length ? (
            <section className={styles.diagnostics} aria-label="Optimizer diagnostics">
              <strong>{evaluation.complete ? "Data notes" : "Incomplete optimization"}</strong>
              <ul>{evaluation.diagnostics.slice(0, 6).map((item, index) => <li key={`${item.code}-${index}`}>{item.message}</li>)}</ul>
            </section>
          ) : null}

          <div className={styles.analysisGrid}>
            <section className={styles.panel}>
              <div className={styles.panelHeading}><div><span className={styles.step}>04</span><h2>Weekly conflicts</h2></div></div>
              <div className={styles.tableScroll}><table><caption>Scheduled, startable, and bench games by Yahoo week</caption><thead><tr><th>Week</th><th>Scheduled</th><th>Startable</th><th>Bench Games</th><th>DUST</th></tr></thead><tbody>{evaluation.weekly.map((week) => <tr key={week.week ?? "unmapped"}><td>{week.week ?? "Unmapped"}</td><td>{week.scheduledGames}</td><td>{week.startableGames}</td><td>{week.benchGames}</td><td>{week.scheduledGames ? formatPercent(week.benchGames / week.scheduledGames) : "0%"}</td></tr>)}</tbody></table></div>
            </section>
            <section className={styles.panel}>
              <div className={styles.panelHeading}><div><span className={styles.step}>05</span><h2>Position congestion</h2></div></div>
              {evaluation.positions.length ? <div className={styles.positionList}>{evaluation.positions.map((position) => { const rate = position.scheduledGames ? position.benchGames / position.scheduledGames : 0; return <div key={position.position}><span>{position.position}</span><div className={styles.meter}><i style={{ width: `${Math.min(100, rate * 100)}%` }} /></div><strong>{position.benchGames} / {position.scheduledGames}</strong></div>; })}</div> : <EmptyPanel>No position conflicts in this horizon.</EmptyPanel>}
            </section>
          </div>

          <section className={styles.panel}>
            <div className={styles.panelHeading}><div><span className={styles.step}>06</span><h2>Daily heatmap</h2></div><span className={styles.statusText}>Select a date for assignments</span></div>
            {evaluation.highestConflictDates.length ? (
              <div className={styles.conflictDates} aria-label="Highest-conflict dates">
                <strong>Highest conflict:</strong>
                {evaluation.highestConflictDates.slice(0, 3).map((day) => (
                  <span key={day.date}>
                    {formatDate(day.date)} · {day.benchGames} Bench Games
                  </span>
                ))}
              </div>
            ) : (
              <p className={styles.assumption}>No Bench Game conflict dates in this horizon.</p>
            )}
            <DailyHeatmap activeSlots={activeSlots} daily={evaluation.daily} playersById={playersById} />
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeading}><div><span className={styles.step}>07</span><h2>Lower-conflict alternatives</h2></div><span className={styles.statusText}>Pareto-efficient DUST / value tradeoffs</span></div>
            {scenarioRoster.length ? (
              <label className={styles.outgoingSelect}>Player to replace<select value={selectedOutgoingId} onChange={(event) => setSelectedOutgoingId(event.target.value)}>{scenarioRoster.map((player) => <option key={player.id} value={player.id}>{player.name ?? player.id}</option>)}</select></label>
            ) : null}
            {alternatives.length ? (
              <div className={styles.tableScroll}><table><caption>One-for-one replacements with less DUST and limited projection value loss</caption><thead><tr><th>Alternative</th><th>DUST saved</th><th>Value tradeoff</th><th>Eligible slots</th><th><span className={styles.srOnly}>Actions</span></th></tr></thead><tbody>{alternatives.map((alternative) => <tr key={alternative.player.id}><td><PlayerName player={alternative.player} /></td><td>−{alternative.dustImprovement}</td><td className={alternative.valueDifference >= 0 ? styles.positive : styles.negative}>{alternative.valueDifference >= 0 ? "+" : ""}{formatValue(alternative.valueDifference)}</td><td>{alternative.overlappingSlotTypes.join("/")}</td><td><button type="button" onClick={() => swapPlayer(selectedOutgoingId, alternative.player.id)}>Swap</button></td></tr>)}</tbody></table></div>
            ) : <EmptyPanel>{scenarioRoster.length ? "No projected one-for-one replacement clears the current DUST and value thresholds." : "Add roster players to calculate alternatives."}</EmptyPanel>}
          </section>
        </>
      ) : null}
    </main>
  );
}
