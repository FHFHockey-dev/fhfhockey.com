import React from "react";
import useSWR from "swr";
import styles from "./GamePreview.module.scss";

type Team = {
  id?: number;
  abbrev?: string;
  score?: number;
};

type SeriesGame = {
  id?: number;
  gameDate?: string;
  gameState?: string;
  awayTeam?: Team;
  homeTeam?: Team;
};

type TeamSeasonStats = {
  ppPctg?: number;
  pkPctg?: number;
  goalsForPerGamePlayed?: number;
  goalsAgainstPerGamePlayed?: number;
};

type RightRailData = {
  seasonSeries?: SeriesGame[];
  teamSeasonStats?: {
    awayTeam?: TeamSeasonStats;
    homeTeam?: TeamSeasonStats;
  };
};

type OddsOffer = {
  providerId?: number;
  value?: string | number;
};

type ScheduleGame = {
  id?: number;
  awayTeam?: { odds?: OddsOffer[] };
  homeTeam?: { odds?: OddsOffer[] };
};

type ScheduleData = {
  gameWeek?: Array<{ games?: ScheduleGame[] }>;
};

export type GamePreviewContext = {
  gameDate?: string;
  awayTeam?: Team;
  homeTeam?: Team;
};

interface GamePreviewProps {
  gameId: string | number;
  gameContext?: GamePreviewContext;
}

async function fetcher<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  return response.json() as Promise<T>;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

// Convert supported American or decimal odds to implied probability. Missing or
// malformed odds stay unavailable; they must never become a plausible estimate.
function getImpliedProbability(value: string | number | undefined): number | null {
  if (value == null) return null;
  const normalized = String(value).trim();
  if (!normalized) return null;

  if (!normalized.startsWith("+") && !normalized.startsWith("-")) {
    const decimal = Number(normalized);
    return Number.isFinite(decimal) && decimal > 1 ? (1 / decimal) * 100 : null;
  }

  if (!/^[+-]\d+$/.test(normalized)) return null;
  const american = Number(normalized);
  if (!Number.isFinite(american) || american === 0) return null;

  return american > 0
    ? (100 / (american + 100)) * 100
    : (-american / (-american + 100)) * 100;
}

function findPreferredOdds(offers: OddsOffer[] | undefined) {
  if (!Array.isArray(offers) || offers.length === 0) return undefined;
  return (
    offers.find((offer) => offer.providerId === 9)?.value ??
    offers.find((offer) => offer.providerId === 8)?.value ??
    offers[0]?.value
  );
}

function getBarWidths(
  awayValue: number | null,
  homeValue: number | null,
): { away: number; home: number } | null {
  if (awayValue == null || homeValue == null) return null;
  const total = awayValue + homeValue;
  if (!Number.isFinite(total) || total <= 0) return null;
  return {
    away: (awayValue / total) * 100,
    home: (homeValue / total) * 100,
  };
}

function DataState({
  children,
  error = false,
}: {
  children: React.ReactNode;
  error?: boolean;
}) {
  return (
    <div
      className={`${styles.dataState} ${error ? styles.dataStateError : ""}`}
      role={error ? "alert" : "status"}
    >
      {children}
    </div>
  );
}

function MetricValue({
  value,
  format,
}: {
  value: number | null;
  format: (metric: number) => string;
}) {
  return value == null ? (
    <span aria-label="Unavailable">—</span>
  ) : (
    <>{format(value)}</>
  );
}

function StrengthBar({
  widths,
}: {
  widths: { away: number; home: number } | null;
}) {
  return widths ? (
    <div className={styles.strengthBarWrap} aria-hidden="true">
      <div
        className={styles.strengthFillAway}
        style={{ width: `${widths.away}%` }}
      />
      <div
        className={styles.strengthFillHome}
        style={{ width: `${widths.home}%` }}
      />
    </div>
  ) : (
    <div
      className={styles.strengthBarUnavailable}
      aria-label="Comparison unavailable"
    />
  );
}

function formatGameDate(value: string | undefined) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function teamAbbreviation(team: Team | undefined, fallback: string) {
  const value = team?.abbrev?.trim();
  return value || fallback;
}

export default function GamePreview({
  gameId,
  gameContext,
}: GamePreviewProps) {
  const { data: rightRail, error: rightRailError } = useSWR<RightRailData>(
    gameId ? `/api/v1/game/${gameId}/right-rail` : null,
    fetcher,
  );

  const currentGame = rightRail?.seasonSeries?.find(
    (game) => game.id === Number(gameId),
  );
  const resolvedGame = currentGame ?? gameContext;
  const gameDate = resolvedGame?.gameDate;

  const { data: scheduleData, error: scheduleError } = useSWR<ScheduleData>(
    gameDate ? `/api/v1/schedule/date/${gameDate}` : null,
    fetcher,
  );

  const rightRailLoading = !rightRail && !rightRailError;
  const scheduleLoading = Boolean(gameDate && !scheduleData && !scheduleError);
  const gameOdds = scheduleData?.gameWeek?.[0]?.games?.find(
    (game) => game.id === Number(gameId),
  );
  const rawAwayProbability = getImpliedProbability(
    findPreferredOdds(gameOdds?.awayTeam?.odds),
  );
  const rawHomeProbability = getImpliedProbability(
    findPreferredOdds(gameOdds?.homeTeam?.odds),
  );
  const probabilityTotal =
    rawAwayProbability != null && rawHomeProbability != null
      ? rawAwayProbability + rawHomeProbability
      : null;
  const awayProbability =
    probabilityTotal != null && probabilityTotal > 0
      ? Math.round((rawAwayProbability! / probabilityTotal) * 100)
      : null;
  const homeProbability =
    awayProbability == null ? null : 100 - awayProbability;

  const awayTeam = resolvedGame?.awayTeam;
  const homeTeam = resolvedGame?.homeTeam;
  const awayAbbrev = teamAbbreviation(awayTeam, "Away");
  const homeAbbrev = teamAbbreviation(homeTeam, "Home");

  const awayStats = rightRail?.teamSeasonStats?.awayTeam;
  const homeStats = rightRail?.teamSeasonStats?.homeTeam;
  const awayGoals = finiteNumber(awayStats?.goalsForPerGamePlayed);
  const homeGoals = finiteNumber(homeStats?.goalsForPerGamePlayed);
  const awayPowerPlay = finiteNumber(awayStats?.ppPctg);
  const homePowerPlay = finiteNumber(homeStats?.ppPctg);
  const awayPenaltyKill = finiteNumber(awayStats?.pkPctg);
  const homePenaltyKill = finiteNumber(homeStats?.pkPctg);
  const availableTeamMetricCount = [
    awayGoals,
    homeGoals,
    awayPowerPlay,
    homePowerPlay,
    awayPenaltyKill,
    homePenaltyKill,
  ].filter((value) => value != null).length;
  const teamStatsComplete = availableTeamMetricCount === 6;
  const goalsBars = getBarWidths(awayGoals, homeGoals);
  const specialTeamsBars = teamStatsComplete
    ? getBarWidths(
        awayPowerPlay! + (1 - homePenaltyKill!),
        homePowerPlay! + (1 - awayPenaltyKill!),
      )
    : null;

  const completedMeetings = (rightRail?.seasonSeries ?? []).filter((game) =>
    ["OFF", "OVER", "FINAL"].includes(game.gameState ?? ""),
  );

  return (
    <div className={styles.bentoGrid}>
      <section className={`${styles.dataPanel} ${styles.panelProbability}`}>
        <div className={styles.panelHeader}>
          <h3>Implied Win Probability</h3>
        </div>
        <div className={styles.panelBody}>
          {awayProbability != null && homeProbability != null ? (
            <div className={styles.probabilityHero}>
              <div className={styles.probScale}>
                <div className={styles.probLabels}>
                  <span className={styles.probAway}>
                    {awayAbbrev} {awayProbability}%
                  </span>
                  <span className={styles.probHome}>
                    {homeAbbrev} {homeProbability}%
                  </span>
                </div>
                <div className={styles.probBar} aria-hidden="true">
                  <div
                    className={styles.probFillAway}
                    style={{ width: `${awayProbability}%` }}
                  />
                  <div
                    className={styles.probFillHome}
                    style={{ width: `${homeProbability}%` }}
                  />
                </div>
                {(awayGoals != null || homeGoals != null) && (
                  <div className={`${styles.probLabels} ${styles.secondaryLabels}`}>
                    <span>
                      Season GF/GP: {awayGoals == null ? "—" : awayGoals.toFixed(1)}
                    </span>
                    <span>
                      Season GF/GP: {homeGoals == null ? "—" : homeGoals.toFixed(1)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : scheduleLoading || (!gameDate && rightRailLoading) ? (
            <DataState>Loading market odds…</DataState>
          ) : scheduleError || (!gameDate && rightRailError) ? (
            <DataState error>Market odds could not be loaded.</DataState>
          ) : (
            <DataState>Market odds are unavailable for this game.</DataState>
          )}
        </div>
      </section>

      <section className={`${styles.dataPanel} ${styles.panelGoalies}`}>
        <div className={styles.panelHeader}>
          <h3>Goalie Matchup</h3>
        </div>
        <div className={styles.panelBody}>
          <DataState>
            Starting goalie data is not provided by this preview source.
          </DataState>
        </div>
      </section>

      <section className={`${styles.dataPanel} ${styles.panelStrengths}`}>
        <div className={styles.panelHeader}>
          <h3>Team Strengths</h3>
        </div>
        <div className={styles.panelBody}>
          {availableTeamMetricCount > 0 ? (
            <>
              {!teamStatsComplete && (
                <p className={styles.partialNote} role="status">
                  Partial team statistics; unavailable fields are shown as —.
                </p>
              )}
              <div className={styles.strengthRow}>
                <div className={styles.strengthLabels}>
                  <span className={styles.strengthValueAway}>
                    <MetricValue value={awayGoals} format={(value) => value.toFixed(2)} />
                  </span>
                  <span>Goals / game</span>
                  <span className={styles.strengthValueHome}>
                    <MetricValue value={homeGoals} format={(value) => value.toFixed(2)} />
                  </span>
                </div>
                <StrengthBar widths={goalsBars} />
              </div>
              <div className={styles.strengthRow}>
                <div className={styles.strengthLabels}>
                  <span className={styles.strengthValueAway}>
                    <MetricValue
                      value={awayPowerPlay}
                      format={(value) => `${(value * 100).toFixed(1)}%`}
                    />
                  </span>
                  <span>PP% vs PK%</span>
                  <span className={styles.strengthValueHome}>
                    <MetricValue
                      value={homePenaltyKill}
                      format={(value) => `${(value * 100).toFixed(1)}%`}
                    />
                  </span>
                </div>
                <StrengthBar widths={specialTeamsBars} />
              </div>
              <div className={styles.strengthRow}>
                <div className={styles.strengthLabels}>
                  <span className={styles.strengthValueAway}>
                    <MetricValue
                      value={awayPenaltyKill}
                      format={(value) => `${(value * 100).toFixed(1)}%`}
                    />
                  </span>
                  <span>PK% vs PP%</span>
                  <span className={styles.strengthValueHome}>
                    <MetricValue
                      value={homePowerPlay}
                      format={(value) => `${(value * 100).toFixed(1)}%`}
                    />
                  </span>
                </div>
                <StrengthBar
                  widths={
                    specialTeamsBars
                      ? {
                          away: specialTeamsBars.home,
                          home: specialTeamsBars.away,
                        }
                      : null
                  }
                />
              </div>
            </>
          ) : rightRailLoading ? (
            <DataState>Loading team statistics…</DataState>
          ) : rightRailError ? (
            <DataState error>Team statistics could not be loaded.</DataState>
          ) : (
            <DataState>Team statistics are unavailable for this game.</DataState>
          )}
        </div>
      </section>

      <section className={`${styles.dataPanel} ${styles.panelLines}`}>
        <div className={styles.panelHeader}>
          <h3>5v5 Line Matchups</h3>
        </div>
        <div className={styles.panelBody}>
          <DataState>
            Line matchup data is not provided by this preview source.
          </DataState>
        </div>
      </section>

      <section className={`${styles.dataPanel} ${styles.panelTrends}`}>
        <div className={styles.panelHeader}>
          <h3>Player Trends</h3>
        </div>
        <div className={styles.panelBody}>
          <DataState>
            Player trend data is not provided by this preview source.
          </DataState>
        </div>
      </section>

      <section className={`${styles.dataPanel} ${styles.panelH2H}`}>
        <div className={styles.panelHeader}>
          <h3>Recent Head-to-Head</h3>
        </div>
        <div className={styles.panelBody}>
          {completedMeetings.length > 0 ? (
            <div className={styles.h2hList}>
              {completedMeetings.map((game, index) => {
                const away = game.awayTeam;
                const home = game.homeTeam;
                const awayScore = finiteNumber(away?.score);
                const homeScore = finiteNumber(home?.score);
                const hasScore = awayScore != null && homeScore != null;
                const homeWon = hasScore && homeScore > awayScore;
                const awayWon = hasScore && awayScore > homeScore;
                const winner = homeWon ? home : awayWon ? away : undefined;

                return (
                  <div className={styles.h2hCard} key={game.id ?? index}>
                    <div className={styles.h2hDate}>
                      {formatGameDate(game.gameDate)}
                    </div>
                    <div className={styles.h2hScore}>
                      {hasScore
                        ? `${teamAbbreviation(away, "Away")} ${awayScore} - ${homeScore} ${teamAbbreviation(home, "Home")}`
                        : "Final score unavailable"}
                    </div>
                    {winner && (
                      <div
                        className={
                          homeWon
                            ? styles.h2hWinnerHome
                            : styles.h2hWinnerAway
                        }
                      >
                        {teamAbbreviation(winner, "Team")} Win
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : rightRailLoading ? (
            <DataState>Loading recent meetings…</DataState>
          ) : rightRailError ? (
            <DataState error>Recent meetings could not be loaded.</DataState>
          ) : Array.isArray(rightRail?.seasonSeries) ? (
            <DataState>No completed meetings found this season.</DataState>
          ) : (
            <DataState>Head-to-head data is unavailable for this game.</DataState>
          )}
        </div>
      </section>
    </div>
  );
}
