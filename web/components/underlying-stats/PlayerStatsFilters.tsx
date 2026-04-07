import {
  isPlayerStatsScopeModifierActive,
  getDefaultLandingSortState,
  type PlayerStatsFilterNormalizationResult,
} from "lib/underlying-stats/playerStatsFilters";
import type {
  PlayerStatsDisplayMode,
  PlayerStatsFilterState,
  PlayerStatsMode,
  PlayerStatsPositionGroup,
  PlayerStatsScoreState,
  PlayerStatsSeasonType,
  PlayerStatsTradeMode,
  PlayerStatsStrength,
  PlayerStatsVenue,
} from "lib/underlying-stats/playerStatsTypes";
import {
  PLAYER_STATS_DISPLAY_MODES,
  PLAYER_STATS_MODE_COMPATIBILITY,
  PLAYER_STATS_POSITION_GROUPS,
  PLAYER_STATS_SCORE_STATES,
  PLAYER_STATS_SEASON_TYPES,
  PLAYER_STATS_STRENGTHS,
  PLAYER_STATS_TRADE_MODES,
  PLAYER_STATS_VENUES,
} from "lib/underlying-stats/playerStatsTypes";

import { resolvePlayerStatsTableFamily } from "./playerStatsColumns";
import styles from "./PlayerStatsFilters.module.scss";

type PlayerStatsSeasonOption = {
  value: number;
  label: string;
};

type PlayerStatsTeamOption = {
  value: number;
  label: string;
};

type PlayerStatsFiltersProps = {
  state: PlayerStatsFilterState;
  seasonOptions: readonly PlayerStatsSeasonOption[];
  teamOptions: readonly PlayerStatsTeamOption[];
  surfaceLabel?: string;
  hideModeControl?: boolean;
  hidePositionGroupControl?: boolean;
  hideTradeModeControl?: boolean;
  headerHintOverride?: string;
  gameRangeLabel?: string;
  gameRangePlaceholder?: string;
  teamGamesLabel?: string;
  teamGamesPlaceholder?: string;
  minimumToiLabel?: string;
  onSeasonRangeChange: (nextRange: {
    fromSeasonId: number;
    throughSeasonId: number;
  }) => void;
  onSeasonTypeChange: (seasonType: PlayerStatsSeasonType) => void;
  onStrengthChange: (strength: PlayerStatsStrength) => void;
  onScoreStateChange: (scoreState: PlayerStatsScoreState) => void;
  onModeChange: (
    mode: PlayerStatsMode
  ) => PlayerStatsFilterNormalizationResult<PlayerStatsFilterState>;
  onDisplayModeChange: (displayMode: PlayerStatsDisplayMode) => void;
  onAdvancedOpenChange: (open: boolean) => void;
  onTeamContextFilterChange: (teamId: number | null) => void;
  onPositionGroupChange: (
    positionGroup: PlayerStatsPositionGroup | null
  ) => void;
  onVenueChange: (venue: PlayerStatsVenue) => void;
  onMinimumToiChange: (minimumToiSeconds: number | null) => void;
  onScopeChange: (scope: PlayerStatsFilterState["expandable"]["scope"]) => void;
  onTradeModeChange: (tradeMode: PlayerStatsTradeMode) => void;
};

const MODE_OPTIONS: Array<{ value: PlayerStatsMode; label: string }> = [
  { value: "onIce", label: "On-Ice" },
  { value: "individual", label: "Individual" },
  { value: "goalies", label: "Goalies" },
];

const DISPLAY_MODE_OPTIONS: Array<{
  value: PlayerStatsDisplayMode;
  label: string;
}> = PLAYER_STATS_DISPLAY_MODES.map((value) => ({
  value,
  label: value === "counts" ? "Counts" : "Rates",
}));

export default function PlayerStatsFilters({
  state,
  seasonOptions,
  teamOptions,
  surfaceLabel = "Player stats",
  hideModeControl = false,
  hidePositionGroupControl = false,
  hideTradeModeControl = false,
  headerHintOverride,
  gameRangeLabel = "# of GP",
  gameRangePlaceholder = "Last X player games",
  teamGamesLabel = "# of Team GP",
  teamGamesPlaceholder = "Last X team games",
  minimumToiLabel = "Minimum TOI",
  onSeasonRangeChange,
  onSeasonTypeChange,
  onStrengthChange,
  onScoreStateChange,
  onModeChange,
  onDisplayModeChange,
  onAdvancedOpenChange,
  onTeamContextFilterChange,
  onPositionGroupChange,
  onVenueChange,
  onMinimumToiChange,
  onScopeChange,
  onTradeModeChange
}: PlayerStatsFiltersProps) {
  const { primary } = state;
  const { expandable } = state;
  const tableFamily = resolvePlayerStatsTableFamily(
    primary.statMode,
    primary.displayMode
  );
  const modeCompatibility = PLAYER_STATS_MODE_COMPATIBILITY[primary.statMode];
  const selectedTeamContextId =
    state.surface === "landing"
      ? state.expandable.teamId
      : state.expandable.againstTeamId;
  const positionOptions = modeCompatibility.supportsPositionFilter
    ? modeCompatibility.allowedPositionGroups
    : [];
  const scopeIsActive = isPlayerStatsScopeModifierActive(expandable.scope);
  const teamLabel =
    state.surface === "landing" ? "Team" : "Against Specific Team";
  const headerHint =
    headerHintOverride ??
    (state.surface === "landing"
      ? "Primary controls drive the canonical landing query."
      : "Primary controls drive the canonical detail query.");
  const dateRangeScope =
    expandable.scope.kind === "dateRange"
      ? expandable.scope
      : { kind: "dateRange" as const, startDate: null, endDate: null };
  const gameRangeValue =
    expandable.scope.kind === "gameRange" ? expandable.scope.value : null;
  const teamGamesValue =
    expandable.scope.kind === "byTeamGames" ? expandable.scope.value : null;

  return (
    <section
      className={styles.root}
      aria-label={`${surfaceLabel} primary controls`}
    >
      <div className={styles.headerRow}>
        <p className={styles.hint}>{headerHint}</p>
        <button
          type="button"
          className={styles.advancedToggle}
          aria-expanded={expandable.advancedOpen}
          onClick={() => onAdvancedOpenChange(!expandable.advancedOpen)}
        >
          {expandable.advancedOpen ? "Hide" : "Show"} advanced filters
        </button>
      </div>

      <div className={styles.primaryGrid}>
        <label className={styles.control}>
          <span className={styles.label}>From Season</span>
          <select
            className={styles.select}
            value={primary.seasonRange.fromSeasonId ?? ""}
            onChange={(event) => {
              const fromSeasonId = Number(event.target.value);
              if (!Number.isFinite(fromSeasonId)) {
                return;
              }

              onSeasonRangeChange({
                fromSeasonId,
                throughSeasonId: Math.max(
                  fromSeasonId,
                  primary.seasonRange.throughSeasonId ?? fromSeasonId
                )
              });
            }}
          >
            {seasonOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.control}>
          <span className={styles.label}>Through Season</span>
          <select
            className={styles.select}
            value={primary.seasonRange.throughSeasonId ?? ""}
            onChange={(event) => {
              const throughSeasonId = Number(event.target.value);
              if (!Number.isFinite(throughSeasonId)) {
                return;
              }

              onSeasonRangeChange({
                fromSeasonId: Math.min(
                  primary.seasonRange.fromSeasonId ?? throughSeasonId,
                  throughSeasonId
                ),
                throughSeasonId
              });
            }}
          >
            {seasonOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.control}>
          <span className={styles.label}>Season Type</span>
          <select
            className={styles.select}
            value={primary.seasonType}
            onChange={(event) =>
              onSeasonTypeChange(event.target.value as PlayerStatsSeasonType)
            }
          >
            {PLAYER_STATS_SEASON_TYPES.map((seasonType) => (
              <option key={seasonType} value={seasonType}>
                {formatSeasonType(seasonType)}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.control}>
          <span className={styles.label}>Strength</span>
          <select
            className={styles.select}
            value={primary.strength}
            onChange={(event) =>
              onStrengthChange(event.target.value as PlayerStatsStrength)
            }
          >
            {PLAYER_STATS_STRENGTHS.map((strength) => (
              <option key={strength} value={strength}>
                {formatStrength(strength)}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.control}>
          <span className={styles.label}>Score State</span>
          <select
            className={styles.select}
            value={primary.scoreState}
            onChange={(event) =>
              onScoreStateChange(event.target.value as PlayerStatsScoreState)
            }
          >
            {PLAYER_STATS_SCORE_STATES.map((scoreState) => (
              <option key={scoreState} value={scoreState}>
                {formatScoreState(scoreState)}
              </option>
            ))}
          </select>
        </label>

        {!hideModeControl ? (
          <label className={styles.control}>
            <span className={styles.label}>Stat Mode</span>
            <select
              className={styles.select}
              value={primary.statMode}
              onChange={(event) =>
                onModeChange(event.target.value as PlayerStatsMode)
              }
            >
              {MODE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className={styles.control}>
          <span className={styles.label}>Display Mode</span>
          <select
            className={styles.select}
            value={primary.displayMode}
            onChange={(event) =>
              onDisplayModeChange(event.target.value as PlayerStatsDisplayMode)
            }
          >
            {DISPLAY_MODE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={styles.scopeGrid}>
        <label className={styles.control}>
          <span className={styles.label}>From Date</span>
          <input
            className={styles.input}
            type="date"
            value={dateRangeScope.startDate ?? ""}
            onChange={(event) => {
              const startDate = event.target.value || null;
              const nextScope =
                startDate == null && dateRangeScope.endDate == null
                  ? { kind: "none" as const }
                  : {
                      kind: "dateRange" as const,
                      startDate,
                      endDate: dateRangeScope.endDate
                    };

              onScopeChange(nextScope);
            }}
          />
        </label>

        <label className={styles.control}>
          <span className={styles.label}>Through Date</span>
          <input
            className={styles.input}
            type="date"
            value={dateRangeScope.endDate ?? ""}
            onChange={(event) => {
              const endDate = event.target.value || null;
              const nextScope =
                dateRangeScope.startDate == null && endDate == null
                  ? { kind: "none" as const }
                  : {
                      kind: "dateRange" as const,
                      startDate: dateRangeScope.startDate,
                      endDate
                    };

              onScopeChange(nextScope);
            }}
          />
        </label>

        <label className={styles.control}>
          <span className={styles.label}>{gameRangeLabel}</span>
          <input
            className={styles.input}
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={gameRangeValue ?? ""}
            onChange={(event) => {
              const value = parseNullableInteger(event.target.value);

              onScopeChange(
                value == null
                  ? { kind: "none" }
                  : {
                      kind: "gameRange",
                      value
                    }
              );
            }}
            placeholder={gameRangePlaceholder}
          />
        </label>

        <label className={styles.control}>
          <span className={styles.label}>{teamGamesLabel}</span>
          <input
            className={styles.input}
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={teamGamesValue ?? ""}
            onChange={(event) => {
              const value = parseNullableInteger(event.target.value);

              onScopeChange(
                value == null
                  ? { kind: "none" }
                  : {
                      kind: "byTeamGames",
                      value
                    }
              );
            }}
            placeholder={teamGamesPlaceholder}
          />
        </label>
      </div>

      <div className={styles.hintRow}>
        <span className={styles.familyBadge}>
          {formatTableFamily(tableFamily)} · default sort{" "}
          {
            getDefaultLandingSortState(primary.statMode, primary.displayMode)
              .sortKey
          }
        </span>
      </div>

      {expandable.advancedOpen ? (
        <div className={styles.advancedPanel}>
          <div className={styles.advancedGrid}>
            <label className={styles.control}>
              <span className={styles.label}>{teamLabel}</span>
              <select
                className={styles.select}
                value={selectedTeamContextId ?? ""}
                onChange={(event) =>
                  onTeamContextFilterChange(
                    event.target.value === ""
                      ? null
                      : Number(event.target.value)
                  )
                }
              >
                <option value="">All Teams</option>
                {teamOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            {!hidePositionGroupControl ? (
              <label className={styles.control}>
                <span className={styles.label}>Position Group</span>
                <select
                  className={styles.select}
                  value={expandable.positionGroup ?? ""}
                  onChange={(event) =>
                    onPositionGroupChange(
                      event.target.value === ""
                        ? null
                        : (event.target.value as PlayerStatsPositionGroup)
                    )
                  }
                  disabled={!modeCompatibility.supportsPositionFilter}
                >
                  <option value="">All Positions</option>
                  {positionOptions.map((positionGroup) => (
                    <option key={positionGroup} value={positionGroup}>
                      {formatPositionGroup(positionGroup)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label className={styles.control}>
              <span className={styles.label}>Home or Away</span>
              <select
                className={styles.select}
                value={expandable.venue}
                onChange={(event) =>
                  onVenueChange(event.target.value as PlayerStatsVenue)
                }
              >
                {PLAYER_STATS_VENUES.map((venue) => (
                  <option key={venue} value={venue}>
                    {formatVenue(venue)}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.control}>
              <span className={styles.label}>{minimumToiLabel}</span>
              <input
                className={styles.input}
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                value={expandable.minimumToiSeconds ?? ""}
                onChange={(event) =>
                  onMinimumToiChange(parseNullableInteger(event.target.value))
                }
                placeholder="Seconds"
              />
            </label>

            {!hideTradeModeControl ? (
              <label className={styles.control}>
                <span className={styles.label}>Combine or Split</span>
                <select
                  className={styles.select}
                  value={expandable.tradeMode}
                  onChange={(event) =>
                    onTradeModeChange(
                      event.target.value as PlayerStatsTradeMode
                    )
                  }
                >
                  {PLAYER_STATS_TRADE_MODES.map((tradeMode) => (
                    <option key={tradeMode} value={tradeMode}>
                      {tradeMode === "combine" ? "Combine" : "Split"}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>

          <div className={styles.advancedMeta}>
            <span className={styles.scopeBadge}>
              {scopeIsActive
                ? `Active scope: ${formatScope(expandable.scope.kind)}`
                : "Active scope: none"}
            </span>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function formatSeasonType(value: PlayerStatsSeasonType): string {
  switch (value) {
    case "regularSeason":
      return "Regular Season";
    case "playoffs":
      return "Playoffs";
    case "preSeason":
      return "Pre-Season";
    default:
      return value;
  }
}

function formatStrength(value: PlayerStatsStrength): string {
  switch (value) {
    case "fiveOnFive":
      return "5v5";
    case "allStrengths":
      return "All Strengths";
    case "evenStrength":
      return "Even Strength";
    case "penaltyKill":
      return "Penalty Kill";
    case "powerPlay":
      return "Power Play";
    case "fiveOnFourPP":
      return "5 on 4 PP";
    case "fourOnFivePK":
      return "4 on 5 PK";
    case "threeOnThree":
      return "3 on 3";
    case "withEmptyNet":
      return "With Empty Net";
    case "againstEmptyNet":
      return "Against Empty Net";
    default:
      return value;
  }
}

function formatScoreState(value: PlayerStatsScoreState): string {
  switch (value) {
    case "allScores":
      return "All Scores";
    case "withinOne":
      return "Within 1";
    case "upOne":
      return "Up 1";
    case "downOne":
      return "Down 1";
    default:
      return value.charAt(0).toUpperCase() + value.slice(1);
  }
}

function formatTableFamily(value: string): string {
  switch (value) {
    case "individualCounts":
      return "Individual Counts";
    case "individualRates":
      return "Individual Rates";
    case "onIceCounts":
      return "On-Ice Counts";
    case "onIceRates":
      return "On-Ice Rates";
    case "goalieCounts":
      return "Goalie Counts";
    case "goalieRates":
      return "Goalie Rates";
    default:
      return value;
  }
}

function formatPositionGroup(value: PlayerStatsPositionGroup): string {
  switch (value) {
    case "skaters":
      return "Skaters";
    case "defensemen":
      return "Defensemen";
    case "centers":
      return "Centers";
    case "leftWings":
      return "Left Wings";
    case "rightWings":
      return "Right Wings";
    case "goalies":
      return "Goalies";
    default:
      return value;
  }
}

function formatVenue(value: PlayerStatsVenue): string {
  switch (value) {
    case "all":
      return "All Games";
    case "home":
      return "Home";
    case "away":
      return "Away";
    default:
      return value;
  }
}

function formatScope(value: PlayerStatsFilterState["expandable"]["scope"]["kind"]): string {
  switch (value) {
    case "dateRange":
      return "date range";
    case "gameRange":
      return "game range";
    case "byTeamGames":
      return "by team games";
    default:
      return "none";
  }
}

function parseNullableInteger(value: string): number | null {
  if (value.trim() === "") {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}
