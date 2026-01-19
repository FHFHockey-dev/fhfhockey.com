import { useEffect, useMemo, useState, ChangeEvent } from "react";
import Head from "next/head";
import type { GetServerSideProps, NextPage } from "next";
import { useRouter } from "next/router";
import { format, parseISO } from "date-fns";
import styles from "./indexUS.module.scss";
import supabaseServer from "../../lib/supabase/server";
import {
  fetchTeamRatings,
  type TeamRating,
  type SpecialTeamTier
} from "../../lib/teamRatingsService";
import { teamsInfo } from "../../lib/teamsInfo";

type PageProps = {
  initialDate: string | null;
  initialRatings: TeamRating[];
  availableDates: string[];
};

const tierLabels: Record<SpecialTeamTier, string> = {
  1: "Tier 1 · Elite",
  2: "Tier 2 · Middle",
  3: "Tier 3 · Subpar"
};

const COMPONENT_RATING_FIELDS = [
  {
    key: "finishingRating",
    label: "Finishing",
    tableLabel: "Finish",
    description: "GF60 vs xGF60"
  },
  {
    key: "goalieRating",
    label: "Goaltending",
    tableLabel: "Goalie",
    description: "xGA60 vs GA60"
  },
  {
    key: "dangerRating",
    label: "Danger Mix",
    tableLabel: "Danger",
    description: "High-danger share"
  },
  {
    key: "specialRating",
    label: "Special Teams",
    tableLabel: "Special",
    description: "PP xGF + PK suppression"
  },
  {
    key: "disciplineRating",
    label: "Discipline",
    tableLabel: "Disc",
    description: "Drawn vs taken penalties"
  }
] as const;

type ComponentRatingKey = (typeof COMPONENT_RATING_FIELDS)[number]["key"];

const formatDateLabel = (isoDate: string): string => {
  try {
    return format(parseISO(isoDate), "MMM d, yyyy");
  } catch {
    return isoDate;
  }
};

const formatRating = (value: number): string => value.toFixed(1);
const formatPer60 = (value: number): string => value.toFixed(2);
const formatTrend = (value: number): string =>
  `${value > 0 ? "+" : ""}${value.toFixed(1)}`;
const formatPower = (value: number): string => value.toFixed(1);
const formatOptionalRating = (value: number | null): string => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "—";
  }
  return formatRating(value);
};

const getTeamName = (abbr: string): string =>
  teamsInfo[abbr as keyof typeof teamsInfo]?.name ?? abbr;

const SPECIAL_TEAM_STEP = 1.5;
const computePowerScore = (team: TeamRating): number => {
  const base = (team.offRating + team.defRating + team.paceRating) / 3;
  const ppAdj = (3 - team.ppTier) * SPECIAL_TEAM_STEP;
  const pkAdj = (3 - team.pkTier) * SPECIAL_TEAM_STEP;
  return base + ppAdj + pkAdj;
};

const TeamPowerRankingsPage: NextPage<PageProps> = ({
  initialDate,
  initialRatings,
  availableDates
}) => {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(initialDate ?? "");
  const [ratings, setRatings] = useState<TeamRating[]>(initialRatings);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep ratings in sync if SSR props change and the selected date matches.
  useEffect(() => {
    if ((initialDate ?? "") === selectedDate) {
      setRatings(initialRatings);
    }
  }, [initialDate, initialRatings, selectedDate]);

  useEffect(() => {
    if (!selectedDate || selectedDate === (initialDate ?? "")) {
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    fetch(`/api/team-ratings?date=${selectedDate}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Unable to load ratings (${response.status})`);
        }
        return response.json() as Promise<TeamRating[]>;
      })
      .then((data) => {
        if (!isMounted) return;
        setRatings(data);
      })
      .catch((fetchError: unknown) => {
        if (!isMounted) return;
        const message =
          fetchError instanceof Error
            ? fetchError.message
            : "Something went wrong while loading ratings.";
        setError(message);
        setRatings([]);
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedDate, initialDate]);

  const dateOptions = useMemo(() => {
    const unique = Array.from(new Set(availableDates));
    if (selectedDate && !unique.includes(selectedDate)) {
      unique.unshift(selectedDate);
    }
    return unique;
  }, [availableDates, selectedDate]);

  const rankedRatings = useMemo(
    () =>
      [...ratings].sort((a, b) => computePowerScore(b) - computePowerScore(a)),
    [ratings]
  );

  const topTeams = useMemo(() => rankedRatings.slice(0, 3), [rankedRatings]);

  const getComponentBadgeClass = (value: number | null): string => {
    if (typeof value !== "number" || Number.isNaN(value)) {
      return styles.componentNeutral;
    }
    if (value >= 105) {
      return styles.componentPositive;
    }
    if (value <= 95) {
      return styles.componentNegative;
    }
    return styles.componentNeutral;
  };

  type SubRatingMetric = {
    key: ComponentRatingKey;
    label: string;
    value: number | null;
    description: string;
  };

  const subRatingMetrics = useMemo(() => {
    const leader = rankedRatings[0];
    if (!leader) return [];
    const items: SubRatingMetric[] = COMPONENT_RATING_FIELDS.map(
      ({ key, label, description }) => ({
        key,
        label,
        description,
        value: leader[key]
      })
    );
    return items.filter(
      (entry): entry is SubRatingMetric & { value: number } =>
        typeof entry.value === "number" && !Number.isNaN(entry.value)
    );
  }, [rankedRatings]);

  const shouldShowSubRatings = subRatingMetrics.length > 0;

  const handleDateChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    setSelectedDate(value);
    router.replace(
      {
        pathname: router.pathname,
        query: value ? { date: value } : {}
      },
      undefined,
      { shallow: true }
    );
  };

  const getTrendClass = (value: number): string => {
    if (value > 0.5) return styles.trendPositive;
    if (value < -0.5) return styles.trendNegative;
    return styles.trendNeutral;
  };

  const resolveTierClass = (tier: SpecialTeamTier): string => {
    switch (tier) {
      case 1:
        return styles.tier1;
      case 2:
        return styles.tier2;
      default:
        return styles.tier3;
    }
  };

  return (
    <>
      <Head>
        <title>Team Power Rankings | FHFHockey</title>
        <meta
          name="description"
          content="Daily team offense, defense, pace ratings with special teams tiers and trends."
        />
      </Head>
      <main className={styles.page}>
        <div style={{ marginBottom: "1rem" }}>
          <a href="/trends">Visit the unified dashboard →</a>
        </div>
        <section className={styles.headerPanel}>
          <div className={styles.header}>
            <div>
              <h1 className={styles.title}>Team Power Rankings</h1>
              <p className={styles.description}>
                Offense, defense, and pace scores are normalized to a 100-point
                league average using per-60 expected and actual results blended
                with an EWMA + shrinkage model. Special teams tiers come from
                daily power-play and penalty-kill percentiles, while the trend
                reflects movement versus each club&apos;s 10-game baseline.
              </p>
            </div>
            <div className={styles.controls}>
              <label className={styles.controlLabel} htmlFor="date-select">
                Snapshot date
              </label>
              <select
                id="date-select"
                className={styles.dateSelect}
                value={selectedDate}
                onChange={handleDateChange}
                disabled={!dateOptions.length}
              >
                {dateOptions.map((date) => (
                  <option key={date} value={date}>
                    {formatDateLabel(date)}
                  </option>
                ))}
              </select>
              <span className={styles.controlHint}>
                Showing {ratings.length} teams · Updated nightly after new games
              </span>
            </div>
          </div>
        </section>

        <section className={styles.secondaryPanels}>
          <details className={styles.legend}>
            <summary className={styles.legendSummary}>
              Metric legend &amp; formulas
            </summary>
            <div className={styles.legendContent}>
              <p>
                <strong>Power Score</strong> averages the offense, defense, and
                pace indices, then adds 1.5 points for each special teams tier
                step (Tier&nbsp;1 → +3, Tier&nbsp;2 → +1.5, Tier&nbsp;3 → 0) for
                both PP and PK.
              </p>
              <p>
                <strong>Offense</strong> = 100 + 15 × Z(<em>0.7×z(xGF60)</em> +
                <em>0.2×z(SF60)</em> + <em>0.1×z(GF60)</em>).{" "}
                <strong>Defense</strong> = 100 + 15 × Z(<em>0.7×z(-xGA60)</em> +
                <em>0.2×z(-SA60)</em> + <em>0.1×z(-GA60)</em>).{" "}
                <strong>Pace</strong> = 100 + 15 × Z(<em>((CF60+CA60)/2)</em>).
              </p>
              <p>
                <strong>Trend</strong> compares today’s offense index against
                each club’s 10-game baseline. <strong>Pace60</strong> is the
                underlying per-60 pace metric from the view.
              </p>
              <p>
                <strong>Component Ratings</strong> turn the newly appended
                finishing, goalie, danger-mix, special teams, and discipline
                columns into the same 100-point scale (105 = strong, 95 = weak)
                for quick trend checks.
              </p>
            </div>
          </details>

          {shouldShowSubRatings && (
            <section className={styles.subRatings}>
              <div className={styles.subRatingsHeader}>
                <div>
                  <h2>Sub-Ratings Spotlight</h2>
                  <p>
                    League-relative scores (100 = average) for the top-ranked
                    club across finishing, goaltending, danger mix, special
                    teams, and discipline.
                  </p>
                </div>
                {rankedRatings[0]?.varianceFlag === 1 && (
                  <span
                    className={styles.varianceFlagBadge}
                    title="PDO variance warning: performance may regress toward expected levels."
                  >
                    ⚠︎ High Variance
                  </span>
                )}
              </div>
              <div className={styles.subRatingsGrid}>
                {subRatingMetrics.map((metric) => (
                  <article key={metric.key} className={styles.subRatingCard}>
                    <span className={styles.subRatingLabel}>
                      {metric.label}
                    </span>
                    <span className={styles.subRatingValue}>
                      {formatRating(metric.value)}
                    </span>
                    <span className={styles.subRatingHint}>
                      {metric.description}
                    </span>
                  </article>
                ))}
              </div>
            </section>
          )}
        </section>

        <section className={styles.summaryGrid} aria-label="Top teams overview">
          {topTeams.length ? (
            topTeams.map((team, index) => (
              <article key={team.teamAbbr} className={styles.summaryCard}>
                <span className={styles.summaryRank}>#{index + 1}</span>
                <div className={styles.summaryHeader}>
                  <span className={styles.summaryTeam}>{team.teamAbbr}</span>
                  <span className={styles.summaryTeamName}>
                    {getTeamName(team.teamAbbr)}
                  </span>
                </div>
                <div className={styles.summaryMetricGroup}>
                  <div className={styles.summaryPower}>
                    {formatPower(computePowerScore(team))}
                    <span className={styles.summaryMetricLabel}>
                      Power Score
                    </span>
                  </div>
                  <div className={styles.summaryMetricRow}>
                    <div>
                      {formatRating(team.offRating)}
                      <span className={styles.summarySubLabel}>Off</span>
                    </div>
                    <div>
                      {formatRating(team.defRating)}
                      <span className={styles.summarySubLabel}>Def</span>
                    </div>
                    <div>
                      {formatRating(team.paceRating)}
                      <span className={styles.summarySubLabel}>Pace</span>
                    </div>
                  </div>
                </div>
                <ul className={styles.summaryDetails}>
                  <li>
                    Trend{" "}
                    <strong className={getTrendClass(team.trend10)}>
                      {formatTrend(team.trend10)}
                    </strong>
                  </li>
                  <li>
                    PP Tier{" "}
                    <strong className={styles.tierInline}>
                      {tierLabels[team.ppTier]}
                    </strong>
                  </li>
                  <li>
                    PK Tier{" "}
                    <strong className={styles.tierInline}>
                      {tierLabels[team.pkTier]}
                    </strong>
                  </li>
                </ul>
              </article>
            ))
          ) : (
            <article className={styles.summaryEmpty}>
              No rankings available for this date yet.
            </article>
          )}
        </section>

        <section className={styles.tableSection} aria-live="polite">
          {isLoading && (
            <div className={styles.loadingBanner}>Loading team ratings…</div>
          )}
          {error && <div className={styles.errorBanner}>{error}</div>}
          {!ratings.length && !isLoading ? (
            <div className={styles.emptyState}>
              No power ranking data is available for{" "}
              {selectedDate ? formatDateLabel(selectedDate) : "this date"}.
              Select another snapshot or refresh later.
            </div>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">#</th>
                    <th scope="col">Team</th>
                    <th scope="col">Power</th>
                    <th scope="col">Off</th>
                    <th scope="col">Def</th>
                    <th scope="col">Pace</th>
                    <th scope="col">Trend</th>
                    <th scope="col">PP Tier</th>
                    <th scope="col">PK Tier</th>
                    <th scope="col">xGF60</th>
                    <th scope="col">xGA60</th>
                    <th scope="col">Pace60</th>
                    {COMPONENT_RATING_FIELDS.map(({ key, tableLabel }) => (
                      <th scope="col" key={key}>
                        {tableLabel}
                      </th>
                    ))}
                    <th scope="col">Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {rankedRatings.map((team, index) => (
                    <tr key={`${team.teamAbbr}-${team.date}`}>
                      <td className={styles.rankCell}>{index + 1}</td>
                      <td className={styles.teamCell}>
                        <span className={styles.teamName}>{team.teamAbbr}</span>
                        <span className={styles.teamMeta}>
                          {getTeamName(team.teamAbbr)}
                          {team.varianceFlag === 1 && (
                            <span
                              className={styles.varianceFlagInline}
                              title="PDO variance warning: recent results may regress toward expected levels."
                            >
                              ⚠︎
                            </span>
                          )}
                        </span>
                      </td>
                      <td className={styles.powerCell}>
                        {formatPower(computePowerScore(team))}
                      </td>
                      <td>{formatRating(team.offRating)}</td>
                      <td>{formatRating(team.defRating)}</td>
                      <td>{formatRating(team.paceRating)}</td>
                      <td
                        className={`${styles.trendCell} ${getTrendClass(
                          team.trend10
                        )}`}
                      >
                        {formatTrend(team.trend10)}
                      </td>
                      <td>
                        <span
                          className={`${styles.tierBadge} ${resolveTierClass(
                            team.ppTier
                          )}`}
                        >
                          {tierLabels[team.ppTier]}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`${styles.tierBadge} ${resolveTierClass(
                            team.pkTier
                          )}`}
                        >
                          {tierLabels[team.pkTier]}
                        </span>
                      </td>
                      <td>{formatPer60(team.components.xgf60)}</td>
                      <td>{formatPer60(team.components.xga60)}</td>
                      <td>{formatPer60(team.components.pace60)}</td>
                      {COMPONENT_RATING_FIELDS.map(({ key }) => {
                        const value = team[key];
                        return (
                          <td
                            key={`${team.teamAbbr}-${key}`}
                            className={styles.componentCell}
                          >
                            <span
                              className={`${styles.componentBadge} ${getComponentBadgeClass(
                                value
                              )}`}
                            >
                              {formatOptionalRating(value)}
                            </span>
                          </td>
                        );
                      })}
                      <td className={styles.varianceCell}>
                        {team.varianceFlag === null ||
                        team.varianceFlag === undefined ? (
                          "—"
                        ) : team.varianceFlag === 1 ? (
                          <span
                            className={`${styles.variancePill} ${styles.varianceHigh}`}
                          >
                            High
                          </span>
                        ) : (
                          <span
                            className={`${styles.variancePill} ${styles.varianceStable}`}
                          >
                            Stable
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </>
  );
};

export const getServerSideProps: GetServerSideProps<PageProps> = async (
  context
) => {
  try {
    const requestedDate =
      typeof context.query.date === "string" ? context.query.date : undefined;

    const supabase = supabaseServer;
    const { data: rawDates, error: datesError } = await supabase
      .from("team_power_ratings_daily")
      .select("date")
      .order("date", { ascending: false })
      .limit(90);

    if (datesError) {
      throw datesError;
    }

    const availableDates = Array.from(
      new Set(
        (rawDates ?? [])
          .map((row) => row.date as string | null)
          .filter((value): value is string => Boolean(value))
      )
    );

    let targetDate = requestedDate ?? availableDates[0] ?? null;
    let initialRatings: TeamRating[] = [];

    if (targetDate) {
      initialRatings = await fetchTeamRatings(targetDate);
      if (!initialRatings.length && availableDates.length) {
        targetDate = availableDates[0];
        initialRatings = await fetchTeamRatings(targetDate);
      }
    }

    return {
      props: {
        initialDate: targetDate,
        initialRatings,
        availableDates
      }
    };
  } catch (error) {
    console.error("Failed to load team power rankings", error);
    return {
      props: {
        initialDate: null,
        initialRatings: [],
        availableDates: []
      }
    };
  }
};

export default TeamPowerRankingsPage;
