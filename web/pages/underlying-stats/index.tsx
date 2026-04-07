import { useEffect, useMemo, useState, ChangeEvent } from "react";
import Head from "next/head";
import type { GetServerSideProps, NextPage } from "next";
import { useRouter } from "next/router";
import { format, parseISO } from "date-fns";
import styles from "./indexUS.module.scss";
import supabaseServer from "../../lib/supabase/server";
import { type SpecialTeamTier } from "../../lib/teamRatingsService";
import { computeTeamPowerScore } from "../../lib/dashboard/teamContext";
import { teamsInfo } from "../../lib/teamsInfo";
import { fetchDistinctUnderlyingStatsSnapshotDates } from "../../lib/underlying-stats/availableSnapshotDates";
import {
  resolveUnderlyingStatsLandingSnapshot,
  type UnderlyingStatsLandingRating,
  type UnderlyingStatsLandingSnapshot
} from "../../lib/underlying-stats/teamLandingRatings";

import UnderlyingStatsNavBar from "../../components/underlying-stats/UnderlyingStatsNavBar";

type PageProps = {
  initialDate: string | null;
  initialRatings: UnderlyingStatsLandingRating[];
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
const formatSos = (value: number | null): string =>
  typeof value === "number" && !Number.isNaN(value) ? value.toFixed(1) : "—";
const formatOptionalRating = (value: number | null): string => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "—";
  }
  return formatRating(value);
};

const getTeamName = (abbr: string): string =>
  teamsInfo[abbr as keyof typeof teamsInfo]?.name ?? abbr;

const TeamPowerRankingsPage: NextPage<PageProps> = ({
  initialDate,
  initialRatings,
  availableDates
}) => {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(initialDate ?? "");
  const [ratings, setRatings] = useState<UnderlyingStatsLandingRating[]>(
    initialRatings
  );
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

    fetch(`/api/underlying-stats/team-ratings?date=${selectedDate}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Unable to load ratings (${response.status})`);
        }
        return response.json() as Promise<UnderlyingStatsLandingSnapshot>;
      })
      .then((data) => {
        if (!isMounted) return;
        setRatings(data.ratings);
        if (data.resolvedDate && data.resolvedDate !== selectedDate) {
          setSelectedDate(data.resolvedDate);
          router.replace(
            {
              pathname: router.pathname,
              query: { date: data.resolvedDate }
            },
            undefined,
            { shallow: true }
          );
        }
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
  }, [selectedDate, initialDate, router]);

  const dateOptions = useMemo(() => {
    const unique = Array.from(new Set(availableDates));
    if (selectedDate && !unique.includes(selectedDate)) {
      unique.unshift(selectedDate);
    }
    return unique;
  }, [availableDates, selectedDate]);

  const rankedRatings = useMemo(
    () =>
      [...ratings].sort(
        (a, b) => computeTeamPowerScore(b) - computeTeamPowerScore(a)
      ),
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

  const getSosClass = (value: number | null): string => {
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
          content="Daily team power rankings with offense, defense, pace, trend, strength of schedule, and special-teams tiers."
        />
      </Head>
      <main className={styles.page}>
        <div className={styles.utilityRow}>
          <a className={styles.utilityLink} href="/trends">
            Visit the unified dashboard →
          </a>
        </div>

        <section className={styles.headerPanel}>
          <div className={styles.topNavRow}>
            <div className={styles.sectionEyebrow}>Underlying stats</div>
            <UnderlyingStatsNavBar />
          </div>
          <div className={styles.header}>
            <div className={styles.headerIntro}>
              <h1 className={styles.title}>Team Power Rankings</h1>
              <p className={styles.description}>
                Daily team snapshot with league-relative offense, defense, and
                pace ratings, special-teams tiers, repaired 10-game trend, and
                strength-of-schedule context.
              </p>
            </div>
            <div
              className={styles.controls}
              role="group"
              aria-label="Snapshot controls"
            >
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
                {ratings.length} teams · Nightly snapshot after games
              </span>
            </div>
          </div>
        </section>

        <section className={styles.secondaryPanels}>
          <div className={styles.legend}>
            <div className={styles.legendSummary}>Metric definitions</div>
            <div className={styles.legendContent}>
              <p>
                <strong>Power Score</strong> = average of Off, Def, and Pace,
                plus 1.5 points for each PP and PK tier step.
              </p>
              <p>
                <strong>Offense</strong> = 100 + 15 × Z(<em>0.7×z(xGF60)</em> +
                <em>0.2×z(SF60)</em> + <em>0.1×z(GF60)</em>).{" "}
                <strong>Defense</strong> = 100 + 15 × Z(<em>0.7×z(-xGA60)</em> +
                <em>0.2×z(-SA60)</em> + <em>0.1×z(-GA60)</em>).{" "}
                <strong>Pace</strong> = 100 + 15 × Z(<em>((CF60+CA60)/2)</em>).
              </p>
              <p>
                <strong>Trend</strong> = current offense rating versus the prior
                10 played snapshots. <strong>SoS</strong> = 50/50 blend of
                opponent record/schedule context and opponents&apos; current
                Power Scores. Both use the same 100-centered page scale.{" "}
                <strong>Pace60</strong> is the underlying per-60 pace metric.
              </p>
              <p>
                <strong>Component Ratings</strong> convert finishing, goalie,
                danger mix, special teams, and discipline into the same
                100-point scale for quick reads.
              </p>
            </div>
          </div>

          {shouldShowSubRatings && (
            <section className={styles.subRatings}>
              <div className={styles.subRatingsHeader}>
                <div>
                  <h2>Sub-Ratings Spotlight</h2>
                  <p>
                    Top-ranked club only. League-relative scores where 100 is
                    average.
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

        <section
          className={styles.summarySection}
          aria-labelledby="top-teams-heading"
        >
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.sectionKicker}>Summary cards</p>
              <h2 className={styles.sectionTitle} id="top-teams-heading">
                Top teams overview
              </h2>
              <p className={styles.sectionDescription}>
                Top three teams with quick context.
              </p>
            </div>
          </div>

          <div className={styles.summaryGrid}>
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
                      {formatPower(computeTeamPowerScore(team))}
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
          </div>
        </section>

        <section
          className={styles.tableSection}
          aria-labelledby="power-rankings-table-heading"
          aria-live="polite"
        >
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.sectionKicker}>Primary surface</p>
              <h2
                className={styles.sectionTitle}
                id="power-rankings-table-heading"
              >
                Daily power rankings table
              </h2>
              <p className={styles.sectionDescription}>
                Full team table for the selected snapshot.
              </p>
            </div>
            <div className={styles.sectionMeta}>
              <span>{rankedRatings.length} teams</span>
              <span>
                {selectedDate
                  ? formatDateLabel(selectedDate)
                  : "Latest snapshot"}
              </span>
            </div>
          </div>

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
                    <th scope="col" title="Strength of Schedule">
                      SoS
                    </th>
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
                        {formatPower(computeTeamPowerScore(team))}
                      </td>
                      <td className={styles.sosCell}>
                        <span
                          className={`${styles.sosPill} ${getSosClass(team.sos)}`}
                          title="Strength of Schedule"
                        >
                          {formatSos(team.sos)}
                        </span>
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
    const availableDates = await fetchDistinctUnderlyingStatsSnapshotDates(
      90,
      supabase
    );

    const snapshot = await resolveUnderlyingStatsLandingSnapshot({
      requestedDate,
      availableDates
    });

    return {
      props: {
        initialDate: snapshot.resolvedDate,
        initialRatings: snapshot.ratings,
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
