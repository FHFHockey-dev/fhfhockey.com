import {
  applyTeamStatsScopeChange,
  getDefaultTeamLandingSortState,
  isTeamStatsScopeModifierActive,
  type TeamStatsLandingFilterState,
} from "lib/underlying-stats/teamStatsFilters";
import type {
  PlayerStatsDisplayMode,
  PlayerStatsScoreState,
  PlayerStatsSeasonType,
  PlayerStatsStrength,
  PlayerStatsVenue,
} from "lib/underlying-stats/playerStatsTypes";
import {
  PLAYER_STATS_DISPLAY_MODES,
  PLAYER_STATS_SCORE_STATES,
  PLAYER_STATS_SEASON_TYPES,
  PLAYER_STATS_STRENGTHS,
  PLAYER_STATS_VENUES,
} from "lib/underlying-stats/playerStatsTypes";

import styles from "./PlayerStatsFilters.module.scss";

type TeamStatsSeasonOption = {
  value: number;
  label: string;
};

type TeamStatsTeamOption = {
  value: number;
  label: string;
};

type TeamStatsFiltersProps = {
  state: TeamStatsLandingFilterState;
  seasonOptions: readonly TeamStatsSeasonOption[];
  teamOptions: readonly TeamStatsTeamOption[];
  onSeasonRangeChange: (nextRange: {
    fromSeasonId: number;
    throughSeasonId: number;
  }) => void;
  onSeasonTypeChange: (seasonType: PlayerStatsSeasonType) => void;
  onStrengthChange: (strength: PlayerStatsStrength) => void;
  onScoreStateChange: (scoreState: PlayerStatsScoreState) => void;
  onDisplayModeChange: (displayMode: PlayerStatsDisplayMode) => void;
  onAdvancedOpenChange: (open: boolean) => void;
  onTeamChange: (teamId: number | null) => void;
  onOpponentChange: (againstTeamId: number | null) => void;
  onVenueChange: (venue: PlayerStatsVenue) => void;
  onMinimumToiChange: (minimumToiSeconds: number | null) => void;
  onScopeChange: (scope: TeamStatsLandingFilterState["expandable"]["scope"]) => void;
};

const DISPLAY_MODE_OPTIONS: Array<{
  value: PlayerStatsDisplayMode;
  label: string;
}> = PLAYER_STATS_DISPLAY_MODES.map((value) => ({
  value,
  label: value === "counts" ? "Counts" : "Rates",
}));

export default function TeamStatsFilters({
  state,
  seasonOptions,
  teamOptions,
  onSeasonRangeChange,
  onSeasonTypeChange,
  onStrengthChange,
  onScoreStateChange,
  onDisplayModeChange,
  onAdvancedOpenChange,
  onTeamChange,
  onOpponentChange,
  onVenueChange,
  onMinimumToiChange,
  onScopeChange,
}: TeamStatsFiltersProps) {
  const { primary, expandable } = state;
  const activeFamily = primary.displayMode === "rates" ? "rates" : "counts";
  const scopeIsActive = isTeamStatsScopeModifierActive(expandable.scope);
  const dateRangeScope =
    expandable.scope.kind === "dateRange"
      ? expandable.scope
      : { kind: "dateRange" as const, startDate: null, endDate: null };
  const gameRangeValue =
    expandable.scope.kind === "gameRange" ? expandable.scope.value : null;
  const teamGameRangeValue =
    expandable.scope.kind === "teamGameRange" ? expandable.scope.value : null;

  return (
    <section className={styles.root} aria-label="Team stats primary controls">
      <div className={styles.headerRow}>
        <p className={styles.hint}>
          Primary controls drive the canonical team landing query.
        </p>
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
                ),
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
                throughSeasonId,
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

        <label className={styles.control}>
          <span className={styles.label}>Display mode</span>
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
              onScopeChange(
                applyTeamStatsScopeChange(state, {
                  kind:
                    startDate == null && dateRangeScope.endDate == null
                      ? "none"
                      : "dateRange",
                  startDate,
                  endDate: dateRangeScope.endDate,
                } as TeamStatsLandingFilterState["expandable"]["scope"]).expandable.scope
              );
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
              onScopeChange(
                applyTeamStatsScopeChange(state, {
                  kind:
                    dateRangeScope.startDate == null && endDate == null
                      ? "none"
                      : "dateRange",
                  startDate: dateRangeScope.startDate,
                  endDate,
                } as TeamStatsLandingFilterState["expandable"]["scope"]).expandable.scope
              );
            }}
          />
        </label>

        <label className={styles.control}>
          <span className={styles.label}># of GP</span>
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
                applyTeamStatsScopeChange(
                  state,
                  value == null ? { kind: "none" } : { kind: "gameRange", value }
                ).expandable.scope
              );
            }}
            placeholder="Last X games"
          />
        </label>

        <label className={styles.control}>
          <span className={styles.label}># of Team GP</span>
          <input
            className={styles.input}
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={teamGameRangeValue ?? ""}
            onChange={(event) => {
              const value = parseNullableInteger(event.target.value);
              onScopeChange(
                applyTeamStatsScopeChange(
                  state,
                  value == null ? { kind: "none" } : { kind: "teamGameRange", value }
                ).expandable.scope
              );
            }}
            placeholder="Last X team games"
          />
        </label>
      </div>

      <div className={styles.hintRow}>
        <span className={styles.familyBadge}>
          {activeFamily === "rates" ? "Team Rates" : "Team Counts"} · default sort{" "}
          {getDefaultTeamLandingSortState(primary.displayMode).sortKey}
        </span>
      </div>

      {expandable.advancedOpen ? (
        <div className={styles.advancedPanel}>
          <div className={styles.advancedGrid}>
            <label className={styles.control}>
              <span className={styles.label}>Team</span>
              <select
                className={styles.select}
                value={expandable.teamId ?? ""}
                onChange={(event) =>
                  onTeamChange(event.target.value === "" ? null : Number(event.target.value))
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

            <label className={styles.control}>
              <span className={styles.label}>Opponent</span>
              <select
                className={styles.select}
                value={expandable.againstTeamId ?? ""}
                onChange={(event) =>
                  onOpponentChange(
                    event.target.value === "" ? null : Number(event.target.value)
                  )
                }
              >
                <option value="">All Opponents</option>
                {teamOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

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
              <span className={styles.label}>Minimum TOI</span>
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
          </div>

          <div className={styles.advancedMeta}>
            <span className={styles.scopeBadge}>
              {scopeIsActive
                ? `Active scope: ${formatScope(expandable.scope.kind)}`
                : "Active scope: none"}
            </span>
            <p className={styles.subtleHint}>
              Minimum TOI is applied after team aggregation.
            </p>
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

function formatScope(
  value: TeamStatsLandingFilterState["expandable"]["scope"]["kind"]
): string {
  switch (value) {
    case "dateRange":
      return "date range";
    case "gameRange":
      return "game range";
    case "teamGameRange":
      return "team game range";
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