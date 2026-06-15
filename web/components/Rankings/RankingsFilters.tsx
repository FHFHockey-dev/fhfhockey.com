import type { ReactNode } from "react";
import { useMemo, useState } from "react";

import {
  CONTEXTUAL_RANKING_METRIC_DEFINITIONS,
  type ContextualRankingMetricKey,
} from "lib/rankings/metricDefinitions";
import { GOALIE_ROLE_FILTER_OPTIONS } from "lib/rankings/goalieMethodology";
import type {
  MatrixMetricColumnDefinition,
  MatrixMetricGroup,
} from "lib/rankings/matrixMetricRegistry";
import type {
  ContextualRankingsDeploymentFilter,
  ContextualRankingsPositionFilter,
} from "lib/rankings/rankingTypes";
import type { RankingsFilterState } from "lib/rankings/rankingUrlState";

import styles from "styles/Rankings.module.scss";

export type { RankingsFilterState };

type RankingsFiltersProps = {
  value: RankingsFilterState;
  onChange: (patch: Partial<RankingsFilterState>) => void;
  showMetric?: boolean;
  matrixMetricGroups?: readonly MatrixMetricGroup[];
  matrixMetricColumns?: readonly MatrixMetricColumnDefinition[];
  methodologyControl?: ReactNode;
};

const WINDOW_OPTIONS = [
  { value: "season", label: "Season" },
  { value: "last5", label: "Last 5" },
  { value: "last10", label: "Last 10" },
  { value: "last20", label: "Last 20" },
] as const;

const POSITION_OPTIONS = [
  { value: "all", label: "All Skaters" },
  { value: "F", label: "Forwards" },
  { value: "D", label: "Defense" },
] as const;

const STRENGTH_OPTIONS = [
  { value: "5v5", label: "5v5" },
  { value: "all", label: "All" },
  { value: "ev", label: "EV" },
  { value: "pp", label: "PP" },
  { value: "pk", label: "PK" },
] as const;

const DISPLAY_MODE_OPTIONS = [
  { value: "both", label: "Both" },
  { value: "percentile", label: "Percentile" },
  { value: "raw_rank", label: "Raw Rank" },
] as const;

function deploymentOptions(position: ContextualRankingsPositionFilter) {
  const ev =
    position === "D"
      ? ["P1", "P2", "P3"]
      : position === "F"
        ? ["L1", "L2", "L3", "L4"]
        : ["L1", "L2", "L3", "L4", "P1", "P2", "P3"];
  return ["all", ...ev, "PP1", "PP2", "PP3", "PK1", "PK2"] as const;
}

function isDeploymentValid(
  deployment: ContextualRankingsDeploymentFilter,
  position: ContextualRankingsPositionFilter,
) {
  return deploymentOptions(position).includes(deployment as any);
}

function csvValues(value: string) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function selectedSet(value: string, allValues: readonly string[]) {
  return new Set(value === "" ? allValues : csvValues(value));
}

function toggleCsvValue(args: {
  current: string;
  value: string;
  allValues: readonly string[];
  checked: boolean;
}) {
  const next = selectedSet(args.current, args.allValues);
  if (args.checked) {
    next.add(args.value);
  } else {
    next.delete(args.value);
  }
  const selected = args.allValues.filter((value) => next.has(value));
  return selected.length === args.allValues.length ? "" : selected.join(",");
}

export default function RankingsFilters({
  value,
  onChange,
  showMetric = true,
  matrixMetricGroups = [],
  matrixMetricColumns = [],
  methodologyControl,
}: RankingsFiltersProps) {
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
  const metrics = CONTEXTUAL_RANKING_METRIC_DEFINITIONS.filter(
    (metric) => metric.entityType === "skater",
  );
  const availableDeploymentOptions = deploymentOptions(value.position);
  const groupKeys = useMemo(
    () => matrixMetricGroups.map((group) => group.key),
    [matrixMetricGroups],
  );
  const columnKeys = useMemo(
    () => matrixMetricColumns.map((column) => column.metricKey),
    [matrixMetricColumns],
  );
  const selectedGroups = selectedSet(value.metricGroups, groupKeys);
  const selectedColumns = selectedSet(value.metricColumns, columnKeys);
  const roleOptions =
    value.entity === "goalies"
      ? GOALIE_ROLE_FILTER_OPTIONS
      : availableDeploymentOptions.map((option) => ({
          value: option,
          label: option === "all" ? "All Deployments" : option,
        }));
  const showMoreFilters = value.entity === "skaters";

  return (
    <section className={styles.filters} aria-label="Ranking filters">
      <div className={`${styles.filterControl} ${styles.playerTypeControl}`}>
        <span>Entity</span>
        <div className={styles.segmentedControl} role="group" aria-label="Ranking entity">
          <button
            type="button"
            aria-pressed={value.entity === "skaters" && value.position === "all"}
            onClick={() =>
              onChange({
                entity: "skaters",
                position: "all",
                deployment: "all",
                goalieRole: "all",
                selectedGoalieId: "",
                selectedTeam: "",
              })
            }
          >
            All Skaters
          </button>
          <button
            type="button"
            aria-pressed={value.entity === "skaters" && value.position === "F"}
            onClick={() =>
              onChange({
                entity: "skaters",
                position: "F",
                deployment: "all",
                goalieRole: "all",
                selectedGoalieId: "",
                selectedTeam: "",
              })
            }
          >
            Forwards
          </button>
          <button
            type="button"
            aria-pressed={value.entity === "skaters" && value.position === "D"}
            onClick={() =>
              onChange({
                entity: "skaters",
                position: "D",
                deployment: "all",
                goalieRole: "all",
                selectedGoalieId: "",
                selectedTeam: "",
              })
            }
          >
            Defensemen
          </button>
          <button
            type="button"
            aria-pressed={value.entity === "goalies"}
            onClick={() =>
              onChange({
                entity: "goalies",
                position: "all",
                deployment: "all",
                goalieRole: "all",
                tab: "rankings",
                selectedPlayerId: "",
                selectedTeam: "",
              })
            }
          >
            Goalies
          </button>
          <button
            type="button"
            aria-pressed={value.entity === "teams"}
            onClick={() =>
              onChange({
                entity: "teams",
                position: "all",
                deployment: "all",
                goalieRole: "all",
                tab: "rankings",
                team: "",
                selectedPlayerId: "",
                selectedGoalieId: "",
              })
            }
          >
            Teams
          </button>
        </div>
      </div>

      <label className={`${styles.filterControl} ${styles.filterSeason}`}>
        <span>Season / Timeframe</span>
        <input
          inputMode="numeric"
          pattern="[0-9]*"
          value={value.season}
          onChange={(event) => onChange({ season: event.target.value })}
        />
      </label>

      <label className={`${styles.filterControl} ${styles.filterWindow}`}>
        <span>Window</span>
        <select
          value={value.window}
          onChange={(event) =>
            onChange({ window: event.target.value as RankingsFilterState["window"] })
          }
        >
          {WINDOW_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      {value.tab === "rankings" ? (
        <label className={`${styles.filterControl} ${styles.searchControl}`}>
          <span>Search</span>
          <input
            type="search"
            placeholder={
              value.entity === "teams"
                ? "Team name or code"
                : value.entity === "goalies"
                  ? "Goalie or team"
                  : "Player or team"
            }
            value={value.search}
            onChange={(event) =>
              onChange({ search: event.target.value, page: "1" })
            }
          />
        </label>
      ) : null}

      {value.tab === "rankings" ? (
        <label className={`${styles.filterControl} ${styles.filterDisplay}`}>
          <span>Display</span>
          <select
            value={value.displayMode}
            onChange={(event) =>
              onChange({
                displayMode: event.target.value as RankingsFilterState["displayMode"],
              })
            }
          >
            {DISPLAY_MODE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {value.entity === "skaters" && showMetric ? (
        <label className={styles.filterControl}>
          <span>Position</span>
          <select
            value={value.position}
            onChange={(event) => {
              const position = event.target
                .value as ContextualRankingsPositionFilter;
              onChange({
                position,
                deployment: isDeploymentValid(value.deployment, position)
                  ? value.deployment
                  : "all",
              });
            }}
          >
            {POSITION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {value.entity !== "teams" ? (
      <label className={`${styles.filterControl} ${styles.filterDeployment}`}>
        <span>{value.entity === "goalies" ? "Role" : "Deployment"}</span>
        <select
          value={value.entity === "goalies" ? value.goalieRole : value.deployment}
          onChange={(event) =>
            value.entity === "goalies"
              ? onChange({
                  goalieRole: event.target.value as RankingsFilterState["goalieRole"],
                  selectedGoalieId: "",
                  page: "1",
                })
              : onChange({
                  deployment: event.target.value as ContextualRankingsDeploymentFilter,
                })
          }
        >
          {roleOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      ) : null}

      {value.entity === "skaters" ? (
      <label className={`${styles.filterControl} ${styles.filterStrength}`}>
        <span>Strength</span>
        <select
          value={value.strength}
          onChange={(event) =>
            onChange({ strength: event.target.value as RankingsFilterState["strength"] })
          }
        >
          {STRENGTH_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      ) : null}

      {showMetric ? (
        <label className={`${styles.filterControl} ${styles.metricControl}`}>
          <span>Metric</span>
          <select
            value={value.metric}
            onChange={(event) =>
              onChange({ metric: event.target.value as ContextualRankingMetricKey })
            }
          >
            {metrics.map((metric) => (
              <option key={metric.metricKey} value={metric.metricKey}>
                {metric.displayName}
                {metric.availabilityStatus === "available" ? "" : " (soon)"}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {value.entity !== "teams" ? (
      <label className={`${styles.filterControl} ${styles.filterMinGp}`}>
        <span>{value.entity === "goalies" ? "Min Starts" : "Min GP"}</span>
        <input
          inputMode="numeric"
          pattern="[0-9]*"
          value={value.minGp}
          onChange={(event) => onChange({ minGp: event.target.value })}
        />
      </label>
      ) : null}

      {value.entity === "goalies" ? (
        <label className={styles.filterControl}>
          <span>Min Shots</span>
          <input
            inputMode="numeric"
            pattern="[0-9]*"
            value={value.minToi}
            onChange={(event) => onChange({ minToi: event.target.value })}
          />
        </label>
      ) : null}

      {showMoreFilters ? (
      <div className={`${styles.filterControl} ${styles.moreFiltersControl}`}>
        <span>Tools</span>
        <button
          type="button"
          aria-expanded={moreFiltersOpen}
          aria-controls="rankings-more-filters"
          onClick={() => setMoreFiltersOpen((open) => !open)}
        >
          More Filters
        </button>
        {moreFiltersOpen ? (
          <div
            id="rankings-more-filters"
            className={styles.moreFiltersPopover}
            role="dialog"
            aria-label="More ranking filters"
          >
            <div className={styles.moreFiltersGrid}>
              <label className={styles.filterControl}>
                <span>Sample</span>
                <select
                  value={value.sampleConfidence}
                  onChange={(event) =>
                    onChange({
                      sampleConfidence: event.target
                        .value as RankingsFilterState["sampleConfidence"],
                      page: "1",
                    })
                  }
                >
                  <option value="all">All Samples</option>
                  <option value="medium_plus">Medium+</option>
                  <option value="high">High Only</option>
                </select>
              </label>

              {value.entity === "skaters" ? (
              <label className={styles.filterControl}>
                <span>Min TOI</span>
                <input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={value.minToi}
                  onChange={(event) => onChange({ minToi: event.target.value, page: "1" })}
                />
              </label>
              ) : null}

              <label className={styles.filterControl}>
                <span>Source Quality</span>
                <select
                  value={value.sourceQuality}
                  onChange={(event) =>
                    onChange({
                      sourceQuality: event.target
                        .value as RankingsFilterState["sourceQuality"],
                    })
                  }
                >
                  <option value="all">All Metrics</option>
                  <option value="clean_only">No Caveats</option>
                  <option value="caveats_only">Caveats Only</option>
                </select>
              </label>

              <label className={styles.filterControl}>
                <span>Team</span>
                <input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="Team ID"
                  value={value.team}
                  onChange={(event) =>
                    onChange({ team: event.target.value, page: "1" })
                  }
                />
              </label>
            </div>

            <fieldset className={styles.moreFiltersFieldset}>
              <legend>Metric Groups</legend>
              <div className={styles.moreFiltersChecks}>
                {matrixMetricGroups.map((group) => (
                  <label key={group.key}>
                    <input
                      type="checkbox"
                      checked={selectedGroups.has(group.key)}
                      onChange={(event) =>
                        onChange({
                          metricGroups: toggleCsvValue({
                            current: value.metricGroups,
                            value: group.key,
                            allValues: groupKeys,
                            checked: event.target.checked,
                          }),
                        })
                      }
                    />
                    <span>{group.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className={styles.moreFiltersFieldset}>
              <legend>Columns</legend>
              <div className={styles.moreFiltersChecks}>
                {matrixMetricColumns.map((column) => (
                  <label key={column.metricKey}>
                    <input
                      type="checkbox"
                      checked={selectedColumns.has(column.metricKey)}
                      onChange={(event) =>
                        onChange({
                          metricColumns: toggleCsvValue({
                            current: value.metricColumns,
                            value: column.metricKey,
                            allValues: columnKeys,
                            checked: event.target.checked,
                          }),
                        })
                      }
                    />
                    <span>{column.shortLabel}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        ) : null}
      </div>
      ) : null}

      {value.entity === "goalies" ? (
        <label className={`${styles.filterControl} ${styles.moreFiltersControl}`}>
          <span>Team</span>
        <input
          type="text"
          inputMode="text"
          placeholder="Team code or name"
          value={value.team}
            onChange={(event) => onChange({ team: event.target.value, page: "1" })}
          />
        </label>
      ) : null}

      {methodologyControl ? (
        <div className={styles.filterMethodologySlot}>{methodologyControl}</div>
      ) : null}
    </section>
  );
}
