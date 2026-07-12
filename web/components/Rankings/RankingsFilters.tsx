import type { ReactNode } from "react";
import { useMemo, useState } from "react";

import {
  CONTEXTUAL_RANKING_METRIC_DEFINITIONS,
  getContextualRankingMetricDefinition,
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
  onReset?: () => void;
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
  { value: "both", label: "Percentile + Rank" },
  { value: "metric_value", label: "Metric Value" },
] as const;

const GOALIE_METRIC_LABELS: Record<RankingsFilterState["goalieMetric"], string> = {
  save_percentage: "SV%",
  relative_save_percentage: "Rel SV%",
  gsax: "GSAx",
  gsaa_per_60: "GSAA/60",
  xga_per_shot_against: "xGA/Shot",
  goalie_value_signal: "Value Signal",
  high_danger_save_percentage: "HD SV%",
  quality_start_pct: "QS%",
  really_bad_start_rate: "RBS%",
  steal_rate: "Steal Rate",
  start_share: "Start Share",
};

const TEAM_METRIC_LABELS: Record<RankingsFilterState["teamMetric"], string> = {
  off_rating: "Off Rating",
  def_rating: "Def Rating",
  xgf60: "xGF/60",
  xga60: "xGA/60",
  xgf_percentage: "xGF%",
  shot_quality: "Shot Quality",
  event_rate: "Event Rate",
  finishing_luck: "Finishing Luck",
  save_luck: "Save Luck",
  net_luck: "Net Luck",
  pace_rating: "Pace Rating",
  special_rating: "Special Teams Rating",
  one_goal_game_rate: "1-Goal Game Rate",
  home_road_point_pct_gap: "Home Edge",
  pp_opportunity_rate: "PP Opp/G",
  penalties_taken_per_60: "Penalties/60",
  forward_top_load_index: "Forward Top Load",
  defense_pair_top_load_index: "Defense Pair Top Load",
  pp1_pp2_usage_share: "PP1/PP2 Usage Share",
};

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

type IconName =
  | "barChart"
  | "book"
  | "calendar"
  | "chevron"
  | "display"
  | "goalie"
  | "info"
  | "layers"
  | "line"
  | "reset"
  | "search"
  | "shield"
  | "sliders"
  | "spark"
  | "strength"
  | "team"
  | "users";

function ToolbarIcon({ name }: { name: IconName }) {
  const imageIconPaths: Partial<Record<IconName, string>> = {
    barChart: "/pictures/bar-chart.png",
    book: "/pictures/book.svg",
    goalie: "/pictures/hockey-mask-188584-the-noun-project-icon-lg.png",
    line: "/pictures/sticks.svg",
    shield: "/pictures/shield.webp",
    sliders: "/pictures/filtersAbacus.svg",
    strength: "/pictures/barbell.png",
    team: "/pictures/multiplePeople.png",
    users: "/pictures/twoPeople.png",
  };
  const imageSrc = imageIconPaths[name];

  if (imageSrc) {
    const imageClassName =
      name === "goalie"
        ? `${styles.toolbarIcon} ${styles.toolbarImageIcon} ${styles.goalieToolbarIcon}`
        : `${styles.toolbarIcon} ${styles.toolbarImageIcon}`;

    return (
      <img
        className={imageClassName}
        src={imageSrc}
        alt=""
        aria-hidden="true"
      />
    );
  }

  const paths: Partial<Record<IconName, ReactNode>> = {
    book: (
      <>
        <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v15H6.5A2.5 2.5 0 0 0 4 20.5z" />
        <path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v15h4.5A2.5 2.5 0 0 1 20 20.5z" />
      </>
    ),
    calendar: (
      <>
        <path d="M7 3v4M17 3v4M4.5 9h15" />
        <rect x="4.5" y="5" width="15" height="15" rx="2" />
      </>
    ),
    chevron: <path d="m7 10 5 5 5-5" />,
    display: (
      <>
        <rect x="5" y="5" width="14" height="14" rx="2" />
        <path d="M8 9h8M8 13h4M14 13h2M8 16h8" />
      </>
    ),
    goalie: (
      <>
        <path d="M12 3c4 2 6 5 6 9 0 4-2.4 7-6 9-3.6-2-6-5-6-9 0-4 2-7 6-9Z" />
        <path d="M9 9h.01M15 9h.01M9 14c2 1.2 4 1.2 6 0" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 11v5M12 8h.01" />
      </>
    ),
    layers: (
      <>
        <path d="m12 3 8 4-8 4-8-4 8-4Z" />
        <path d="m4 12 8 4 8-4M4 17l8 4 8-4" />
      </>
    ),
    line: (
      <>
        <path d="M4 12h5M15 12h5M9 8v8M15 8v8" />
        <path d="M9 12h6" />
      </>
    ),
    reset: (
      <>
        <path d="M5 12a7 7 0 1 0 2-5" />
        <path d="M5 4v5h5" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="6" />
        <path d="m16 16 4 4" />
      </>
    ),
    shield: (
      <>
        <path d="M12 3 19 6v5c0 4.5-2.6 8-7 10-4.4-2-7-5.5-7-10V6l7-3Z" />
        <path d="M12 8v8M9 12h6" />
      </>
    ),
    sliders: (
      <>
        <path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h10M18 17h2" />
        <circle cx="15" cy="7" r="2" />
        <circle cx="9" cy="12" r="2" />
        <circle cx="16" cy="17" r="2" />
      </>
    ),
    spark: (
      <>
        <path d="M4 19V9M9 19V5M14 19v-7M19 19V3" />
        <path d="M4 19h16" />
      </>
    ),
    team: (
      <>
        <circle cx="8" cy="9" r="3" />
        <circle cx="16" cy="9" r="3" />
        <path d="M3.5 20c.8-3 2.3-5 4.5-5s3.7 2 4.5 5M11.5 20c.8-3 2.3-5 4.5-5s3.7 2 4.5 5" />
      </>
    ),
    users: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 18c1-3.2 2.8-5 5.5-5s4.5 1.8 5.5 5" />
        <path d="M16 6.5a2.5 2.5 0 0 1 0 5M17 13c1.8.7 3 2.3 3.5 5" />
      </>
    ),
  };

  return (
    <svg
      className={styles.toolbarIcon}
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
    >
      {paths[name]}
    </svg>
  );
}

function formatSeasonLabel(season: string) {
  const compact = season.replace(/\D/g, "");
  if (compact.length === 8) {
    return `${compact.slice(0, 4)}-${compact.slice(4)}`;
  }
  return season;
}

function peerGroupLabel(value: RankingsFilterState) {
  if (value.entity === "teams") return "Teams";
  if (value.entity === "goalies") return "Goalies";
  if (value.position === "F") return "Forwards";
  if (value.position === "D") return "Defensemen";
  return "All Skaters";
}

function rankingMetricLabel(value: RankingsFilterState) {
  if (value.entity === "goalies") {
    return `${GOALIE_METRIC_LABELS[value.goalieMetric] ?? value.goalieMetric} Percentile`;
  }
  if (value.entity === "teams") {
    return `${TEAM_METRIC_LABELS[value.teamMetric] ?? value.teamMetric} Percentile`;
  }

  const activeMetric = getContextualRankingMetricDefinition(
    value.tab === "rankings" ? value.matrixSortMetric : value.metric,
  );
  return activeMetric ? `${activeMetric.displayName} Percentile` : "Skater Metric";
}

export default function RankingsFilters({
  value,
  onChange,
  onReset,
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
  const activeMetricLabel = rankingMetricLabel(value);
  const showMoreFilters = true;

  return (
    <section className={styles.filters} aria-label="Ranking filters">
      <div className={`${styles.filterControl} ${styles.playerTypeControl}`}>
        <span>View</span>
        <div
          className={styles.segmentedControl}
          role="group"
          aria-label="Ranking entity"
        >
          <button
            type="button"
            aria-pressed={
              value.entity === "skaters" && value.position === "all"
            }
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
            <ToolbarIcon name="users" />
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
            <ToolbarIcon name="line" />
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
            <ToolbarIcon name="shield" />
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
            <ToolbarIcon name="goalie" />
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
            <ToolbarIcon name="team" />
            Teams
          </button>
        </div>
      </div>

      {value.tab === "rankings" ? (
        <label className={`${styles.filterControl} ${styles.searchControl}`}>
          <span>Search</span>
          <div className={styles.controlField}>
            <ToolbarIcon name="search" />
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
          </div>
        </label>
      ) : null}

      <label className={`${styles.filterControl} ${styles.filterSeason}`}>
        <span>Season</span>
        <div className={styles.controlField}>
          <ToolbarIcon name="calendar" />
          <input
            inputMode="numeric"
            pattern="[0-9]*"
            value={formatSeasonLabel(value.season)}
            onChange={(event) =>
              onChange({ season: event.target.value.replace(/\D/g, "") })
            }
          />
          <ToolbarIcon name="chevron" />
        </div>
      </label>

      <label className={`${styles.filterControl} ${styles.filterWindow}`}>
        <span>Window</span>
        <div className={styles.controlField}>
          <ToolbarIcon name="calendar" />
          <select
            value={value.window}
            onChange={(event) =>
              onChange({
                window: event.target.value as RankingsFilterState["window"],
              })
            }
          >
            {WINDOW_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ToolbarIcon name="chevron" />
        </div>
      </label>

      {value.tab === "rankings" ? (
        <label className={`${styles.filterControl} ${styles.filterDisplay}`}>
          <span>Display</span>
          <div className={styles.controlField}>
            <ToolbarIcon name="display" />
            <select
              value={value.displayMode}
              onChange={(event) =>
                onChange({
                  displayMode: event.target
                    .value as RankingsFilterState["displayMode"],
                })
              }
            >
              {DISPLAY_MODE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ToolbarIcon name="chevron" />
          </div>
        </label>
      ) : null}

      {value.entity !== "teams" ? (
        <label className={`${styles.filterControl} ${styles.filterDeployment}`}>
          <span>{value.entity === "goalies" ? "Role" : "Deployment"}</span>
          <div className={styles.controlField}>
            <ToolbarIcon name="sliders" />
            <select
              value={
                value.entity === "goalies" ? value.goalieRole : value.deployment
              }
              onChange={(event) =>
                value.entity === "goalies"
                  ? onChange({
                      goalieRole: event.target
                        .value as RankingsFilterState["goalieRole"],
                      selectedGoalieId: "",
                      page: "1",
                    })
                  : onChange({
                      deployment: event.target
                        .value as ContextualRankingsDeploymentFilter,
                    })
              }
            >
              {roleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ToolbarIcon name="chevron" />
          </div>
        </label>
      ) : null}

      {value.entity !== "teams" ? (
        <label className={`${styles.filterControl} ${styles.filterMinGp}`}>
          <span>{value.entity === "goalies" ? "Min Starts" : "Min GP"}</span>
          <div className={styles.controlField}>
            <ToolbarIcon name="barChart" />
            <input
              inputMode="numeric"
              pattern="[0-9]*"
              value={value.minGp}
              onChange={(event) => onChange({ minGp: event.target.value })}
            />
            <ToolbarIcon name="chevron" />
          </div>
        </label>
      ) : null}

      {value.entity === "skaters" ? (
        <label className={`${styles.filterControl} ${styles.filterStrength}`}>
          <span>Strength</span>
          <div className={styles.controlField}>
            <ToolbarIcon name="strength" />
            <select
              value={value.strength}
              onChange={(event) =>
                onChange({
                  strength: event.target
                    .value as RankingsFilterState["strength"],
                })
              }
            >
              {STRENGTH_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ToolbarIcon name="chevron" />
          </div>
        </label>
      ) : null}

      {value.entity === "goalies" ? (
        <label className={`${styles.filterControl} ${styles.filterMinShots}`}>
          <span>Min Shots</span>
          <div className={styles.controlField}>
            <ToolbarIcon name="spark" />
            <input
              inputMode="numeric"
              pattern="[0-9]*"
              value={value.minToi}
              onChange={(event) => onChange({ minToi: event.target.value })}
            />
          </div>
        </label>
      ) : null}

      <div className={styles.filtersSideRail}>
        <div className={styles.filtersActions}>
          {showMoreFilters ? (
            <div
              className={`${styles.filterControl} ${styles.moreFiltersControl}`}
            >
              <span>Tools</span>
              <button
                type="button"
                aria-label="More Filters"
                aria-expanded={moreFiltersOpen}
                aria-controls="rankings-more-filters"
                onClick={() => setMoreFiltersOpen((open) => !open)}
              >
                <ToolbarIcon name="sliders" />
                More Filters
                <ToolbarIcon name="chevron" />
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
                          onChange={(event) =>
                            onChange({ minToi: event.target.value, page: "1" })
                          }
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

                    {value.entity !== "teams" ? (
                      <label className={styles.filterControl}>
                        <span>Team</span>
                        <input
                          type="text"
                          inputMode="text"
                          placeholder="Team code or name"
                          value={value.team}
                          onChange={(event) =>
                            onChange({ team: event.target.value, page: "1" })
                          }
                        />
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
                              deployment: isDeploymentValid(
                                value.deployment,
                                position,
                              )
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

                    {showMetric ? (
                      <label className={styles.filterControl}>
                        <span>Metric</span>
                        <select
                          value={value.metric}
                          onChange={(event) =>
                            onChange({
                              metric: event.target
                                .value as ContextualRankingMetricKey,
                            })
                          }
                        >
                          {metrics.map((metric) => (
                            <option
                              key={metric.metricKey}
                              value={metric.metricKey}
                            >
                              {metric.displayName}
                              {metric.availabilityStatus === "available"
                                ? ""
                                : " (soon)"}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
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

          {onReset ? (
            <button
              className={styles.resetFiltersButton}
              type="button"
              onClick={onReset}
            >
              <ToolbarIcon name="reset" />
              Reset
            </button>
          ) : null}
        </div>

        <aside
          className={styles.quickInfoPanel}
          aria-label="Ranking quick info"
        >
          <header>
            <ToolbarIcon name="spark" />
            <h2>Quick Info</h2>
          </header>
          <dl>
            <div>
              <dt>Ranking metric</dt>
              <dd>{activeMetricLabel}</dd>
            </div>
            <div>
              <dt>Peer group</dt>
              <dd>{peerGroupLabel(value)}</dd>
            </div>
          </dl>
        </aside>

        {methodologyControl ? (
          <div
            className={`${styles.filterControl} ${styles.filterMethodologyControl}`}
          >
            {methodologyControl}
          </div>
        ) : null}
      </div>
    </section>
  );
}
