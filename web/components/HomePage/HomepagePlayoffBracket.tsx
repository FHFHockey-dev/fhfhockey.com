import { type CSSProperties } from "react";

import Link from "next/link";
import moment from "moment";

import ClientOnly from "components/ClientOnly";
import OptimizedImage from "components/common/OptimizedImage";
import {
  type PlayoffBracketResponse,
  type PlayoffBracketSeries
} from "lib/NHL/server/playoffBracket";
import { fallbackNHLLogo, getTeamLogoSvg } from "lib/images";
import { teamsInfo } from "lib/teamsInfo";

import {
  formatPlayoffCenterLine,
  isFinalGameState,
  isLiveGameState
} from "./homepageGameFormatting";
import styles from "./HomepagePlayoffBracket.module.scss";

type PlayoffGame = {
  id: number;
  scheduleDate?: string;
  startTimeUTC?: string;
  gameState?: string;
  timeRemaining?: string;
  inIntermission?: boolean;
  clock?: {
    timeRemaining?: string;
    inIntermission?: boolean;
  } | null;
  period?: number;
  periodType?: string;
  periodDescriptor?: {
    number?: number;
    periodType?: string;
  } | null;
  awayTeam?: {
    id?: number;
    abbrev?: string;
    score?: number;
  };
  homeTeam?: {
    id?: number;
    abbrev?: string;
    score?: number;
  };
  seriesStatus?: {
    seriesLetter?: string;
    topSeedWins?: number;
    bottomSeedWins?: number;
  };
};

type HomepagePlayoffBracketProps = {
  currentDate: string;
  games: PlayoffGame[];
  playoffBracket: PlayoffBracketResponse;
  playoffWeekGames: PlayoffGame[];
};

const WEST_ROUND_ONE_LETTERS = ["E", "F", "G", "H"];
const EAST_ROUND_ONE_LETTERS = ["A", "B", "C", "D"];
const WEST_ROUND_TWO_LETTERS = ["K", "L"];
const EAST_ROUND_TWO_LETTERS = ["I", "J"];
const EAST_FINAL_LETTER = "M";
const WEST_FINAL_LETTER = "N";
const CUP_FINAL_LETTER = "O";

function getSeriesByLetter(
  series: PlayoffBracketSeries[],
  letter: string
): PlayoffBracketSeries | null {
  return series.find((entry) => entry.seriesLetter === letter) ?? null;
}

function getSeriesGroup(
  series: PlayoffBracketSeries[],
  letters: string[]
) {
  return letters
    .map((letter) => getSeriesByLetter(series, letter))
    .filter((entry): entry is PlayoffBracketSeries => entry !== null);
}

function getSeriesGames(
  games: PlayoffGame[],
  seriesLetter: string
) {
  return games
    .filter((game) => game.seriesStatus?.seriesLetter === seriesLetter)
    .sort((left, right) => {
      const leftTime = left.startTimeUTC ? new Date(left.startTimeUTC).getTime() : 0;
      const rightTime = right.startTimeUTC ? new Date(right.startTimeUTC).getTime() : 0;
      return leftTime - rightTime;
    });
}

function getDisplayGameForSeries(
  seriesLetter: string,
  currentGames: PlayoffGame[],
  weekGames: PlayoffGame[]
) {
  const currentGame = currentGames.find(
    (game) => game.seriesStatus?.seriesLetter === seriesLetter
  );
  if (currentGame) {
    return currentGame;
  }

  const scheduledGames = getSeriesGames(weekGames, seriesLetter);
  const nextUpcoming = scheduledGames.find(
    (game) => !isFinalGameState(game.gameState)
  );

  return nextUpcoming ?? scheduledGames.at(-1) ?? null;
}

function getSeriesWins(series: PlayoffBracketSeries, game: PlayoffGame | null) {
  return {
    topSeedWins: game?.seriesStatus?.topSeedWins ?? series.topSeedWins ?? 0,
    bottomSeedWins: game?.seriesStatus?.bottomSeedWins ?? series.bottomSeedWins ?? 0
  };
}

function getSeriesCardTone(game: PlayoffGame | null) {
  if (!game?.gameState) return styles.upcoming;
  if (isLiveGameState(game.gameState)) return styles.live;
  if (isFinalGameState(game.gameState)) return styles.final;
  return styles.upcoming;
}

function getSeriesHref(game: PlayoffGame | null) {
  return game?.id ? `/game/${game.id}` : null;
}

function getTeamScoreForSeriesTeam(
  seriesTeamAbbrev: string | undefined,
  gameTeam: PlayoffGame["homeTeam"] | PlayoffGame["awayTeam"] | undefined
) {
  if (!seriesTeamAbbrev || !gameTeam?.abbrev || typeof gameTeam.score !== "number") {
    return null;
  }

  return gameTeam.abbrev === seriesTeamAbbrev ? gameTeam.score : null;
}

function getDisplayedSeriesScore(
  seriesTeamAbbrev: string | undefined,
  game: PlayoffGame | null
) {
  if (!game || (!isLiveGameState(game.gameState) && !isFinalGameState(game.gameState))) {
    return null;
  }

  return (
    getTeamScoreForSeriesTeam(seriesTeamAbbrev, game.homeTeam) ??
    getTeamScoreForSeriesTeam(seriesTeamAbbrev, game.awayTeam)
  );
}

function getSeriesCardVariantClass(series: PlayoffBracketSeries) {
  if (series.seriesLetter === CUP_FINAL_LETTER) {
    return styles.cupFinalCard;
  }

  if (series.seriesAbbrev === "CF") {
    return styles.conferenceFinalCard;
  }

  if (series.seriesAbbrev === "R2") {
    return styles.roundTwoCard;
  }

  return styles.roundOneCard;
}

function renderProgressDots(
  teamColor: string,
  wins: number,
  direction: "top" | "bottom"
) {
  const filledCount = Math.min(wins, 3);
  const dots = Array.from({ length: 3 }, (_, index) => {
    const filledIndex = direction === "top" ? 3 - index : index + 1;
    const filled = filledIndex <= filledCount;

    return (
      <span
        key={`${direction}-${index}`}
        className={`${styles.seriesDot} ${filled ? styles.seriesDotFilled : ""}`}
        style={{ "--series-dot-color": teamColor } as CSSProperties}
      />
    );
  });

  return direction === "top" ? dots : dots;
}

function PlayoffSeriesCard({
  series,
  currentGames,
  weekGames
}: {
  series: PlayoffBracketSeries;
  currentGames: PlayoffGame[];
  weekGames: PlayoffGame[];
}) {
  const topSeedTeam = series.topSeedTeam;
  const bottomSeedTeam = series.bottomSeedTeam;
  const game = getDisplayGameForSeries(series.seriesLetter, currentGames, weekGames);

  if (!topSeedTeam?.abbrev || !bottomSeedTeam?.abbrev) {
    return <PlayoffPlaceholderCard series={series} />;
  }

  const topSeedInfo = teamsInfo[topSeedTeam.abbrev];
  const bottomSeedInfo = teamsInfo[bottomSeedTeam.abbrev];
  const { topSeedWins, bottomSeedWins } = getSeriesWins(series, game);
  const topSeedScore = getDisplayedSeriesScore(topSeedTeam.abbrev, game);
  const bottomSeedScore = getDisplayedSeriesScore(bottomSeedTeam.abbrev, game);
  const href = getSeriesHref(game);
  const cardTone = getSeriesCardTone(game);
  const variantClass = getSeriesCardVariantClass(series);

  const card = (
    <div
      className={`${styles.seriesCard} ${variantClass} ${cardTone}`}
      style={
        {
          "--top-team-color":
            topSeedInfo?.lightColor ?? topSeedInfo?.primaryColor ?? "#7aa7ff",
          "--bottom-team-color":
            bottomSeedInfo?.lightColor ?? bottomSeedInfo?.primaryColor ?? "#ff8e8e"
        } as CSSProperties
      }
    >
      <div className={styles.seriesMain}>
        <div className={styles.seriesTeamRow}>
          <div className={styles.seriesTeamMeta}>
            <OptimizedImage
              src={getTeamLogoSvg(topSeedTeam.abbrev)}
              alt={`${topSeedTeam.abbrev} logo`}
              width={42}
              height={42}
              fallbackSrc={fallbackNHLLogo}
              className={styles.seriesTeamLogo}
            />
            <div className={styles.seriesTeamText}>
              <span className={styles.seriesTeamAbbrev}>{topSeedTeam.abbrev}</span>
              <span className={styles.seriesTeamSeed}>({series.topSeedRankAbbrev})</span>
            </div>
          </div>
          <span
            className={`${styles.seriesScore} ${topSeedScore === null ? styles.seriesScoreHidden : ""}`}
          >
            {topSeedScore ?? "0"}
          </span>
        </div>

        <div className={styles.seriesCenterLine}>
          <span className={styles.seriesCenterRule} />
          <ClientOnly>
            <span className={styles.seriesCenterText}>
              {formatPlayoffCenterLine(game)}
            </span>
          </ClientOnly>
          <span className={styles.seriesCenterRule} />
        </div>

        <div className={styles.seriesTeamRow}>
          <div className={styles.seriesTeamMeta}>
            <OptimizedImage
              src={getTeamLogoSvg(bottomSeedTeam.abbrev)}
              alt={`${bottomSeedTeam.abbrev} logo`}
              width={42}
              height={42}
              fallbackSrc={fallbackNHLLogo}
              className={styles.seriesTeamLogo}
            />
            <div className={styles.seriesTeamText}>
              <span className={styles.seriesTeamAbbrev}>{bottomSeedTeam.abbrev}</span>
              <span className={styles.seriesTeamSeed}>({series.bottomSeedRankAbbrev})</span>
            </div>
          </div>
          <span
            className={`${styles.seriesScore} ${bottomSeedScore === null ? styles.seriesScoreHidden : ""}`}
          >
            {bottomSeedScore ?? "0"}
          </span>
        </div>
      </div>

      <div className={styles.seriesProgress}>
        {renderProgressDots(
          topSeedInfo?.lightColor ?? topSeedInfo?.primaryColor ?? "#7aa7ff",
          topSeedWins,
          "top"
        )}
        <span className={styles.seriesClincherDot} />
        {renderProgressDots(
          bottomSeedInfo?.lightColor ?? bottomSeedInfo?.primaryColor ?? "#ff8e8e",
          bottomSeedWins,
          "bottom"
        )}
      </div>
    </div>
  );

  if (!href) {
    return card;
  }

  return (
    <Link href={href} className={styles.seriesCardLink}>
      {card}
    </Link>
  );
}

function PlayoffPlaceholderCard({ series }: { series: PlayoffBracketSeries }) {
  const variantClass = getSeriesCardVariantClass(series);
  const showConferenceLogoOnly = series.seriesAbbrev === "CF" && Boolean(series.seriesLogo);
  const showTitle = !showConferenceLogoOnly;

  return (
    <div
      className={`${styles.seriesCard} ${variantClass} ${styles.placeholderCard}`}
    >
      <div className={styles.placeholderInner}>
        {!showConferenceLogoOnly ? (
          <span className={styles.placeholderAbbrev}>{series.seriesAbbrev}</span>
        ) : null}
        {series.seriesLogo ? (
          <OptimizedImage
            src={series.seriesLogo}
            alt={series.seriesTitle}
            className={`${styles.placeholderLogo} ${showConferenceLogoOnly ? styles.conferencePlaceholderLogo : ""}`}
            width={120}
            height={64}
            unoptimized
            fallbackSrc={fallbackNHLLogo}
          />
        ) : (
          <div className={styles.placeholderShield} aria-hidden="true" />
        )}
        {showTitle ? (
          <span className={styles.placeholderTitle}>{series.seriesTitle}</span>
        ) : null}
      </div>
    </div>
  );
}

function getRailDayGroups(games: PlayoffGame[]) {
  const grouped = new Map<string, PlayoffGame[]>();

  [...games]
    .sort((left, right) => {
      const leftTime = left.startTimeUTC ? new Date(left.startTimeUTC).getTime() : 0;
      const rightTime = right.startTimeUTC ? new Date(right.startTimeUTC).getTime() : 0;
      return leftTime - rightTime;
    })
    .forEach((game) => {
      const key =
        game.scheduleDate ||
        (game.startTimeUTC ? moment(game.startTimeUTC).format("YYYY-MM-DD") : "unscheduled");

      if (!grouped.has(key)) {
        grouped.set(key, []);
      }

      grouped.get(key)?.push(game);
    });

  return Array.from(grouped.entries())
    .slice(0, 3)
    .map(([date, groupedGames], index) => ({
      key: date,
      label: moment(date).format("ddd, MMM D"),
      subtitle: index === 0 ? "Today" : index === 1 ? "Tomorrow" : "Next",
      games: groupedGames
    }));
}

function TodaySeriesRail({ games }: { games: PlayoffGame[] }) {
  const dayGroups = getRailDayGroups(games);

  if (dayGroups.length === 0) {
    return (
      <div className={styles.railEmpty}>
        No playoff games scheduled on this date.
      </div>
    );
  }

  return (
    <div className={styles.railScroller}>
      {dayGroups.map((group) => (
        <section key={group.key} className={styles.railDayGroup}>
          <div className={styles.railDayDivider}>
            <span className={styles.railDayEyebrow}>{group.subtitle}</span>
            <span className={styles.railDayLabel}>{group.label}</span>
          </div>

          <div className={styles.railDayGames}>
            {group.games.map((game) => {
              const homeAbbrev = game.homeTeam?.abbrev ?? "HOME";
              const awayAbbrev = game.awayTeam?.abbrev ?? "AWAY";
              const homeInfo = teamsInfo[homeAbbrev];
              const awayInfo = teamsInfo[awayAbbrev];

              return (
                <Link
                  key={game.id}
                  href={`/game/${game.id}`}
                  className={styles.railItem}
                  style={
                    {
                      "--rail-home-color":
                        homeInfo?.lightColor ?? homeInfo?.primaryColor ?? "#7aa7ff",
                      "--rail-away-color":
                        awayInfo?.lightColor ?? awayInfo?.primaryColor ?? "#ff8e8e"
                    } as CSSProperties
                  }
                >
                  <ClientOnly>
                    <span className={styles.railStatus}>
                      {formatPlayoffCenterLine(game)}
                    </span>
                  </ClientOnly>
                  <div className={styles.railTeams}>
                    <div className={styles.railTeam}>
                      <OptimizedImage
                        src={getTeamLogoSvg(awayAbbrev)}
                        alt={`${awayAbbrev} logo`}
                        width={28}
                        height={28}
                        fallbackSrc={fallbackNHLLogo}
                        className={styles.railTeamLogo}
                      />
                      <span className={styles.railTeamAbbrev}>{awayAbbrev}</span>
                      <span className={styles.railScore}>
                        {game.awayTeam?.score ?? "-"}
                      </span>
                    </div>
                    <div className={styles.railTeam}>
                      <OptimizedImage
                        src={getTeamLogoSvg(homeAbbrev)}
                        alt={`${homeAbbrev} logo`}
                        width={28}
                        height={28}
                        fallbackSrc={fallbackNHLLogo}
                        className={styles.railTeamLogo}
                      />
                      <span className={styles.railTeamAbbrev}>{homeAbbrev}</span>
                      <span className={styles.railScore}>
                        {game.homeTeam?.score ?? "-"}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function RoundColumn({
  title,
  roundKey,
  series,
  currentGames,
  weekGames,
  align = "start"
}: {
  title: string;
  roundKey: "roundOne" | "roundTwo" | "conferenceFinal";
  series: PlayoffBracketSeries[];
  currentGames: PlayoffGame[];
  weekGames: PlayoffGame[];
  align?: "start" | "middle" | "center";
}) {
  return (
    <div
      className={`${styles.roundColumn} ${styles[roundKey]} ${styles[`align${align[0].toUpperCase()}${align.slice(1)}`]}`}
    >
      <span className={styles.roundLabel}>{title}</span>
      <div className={styles.roundStack}>
        {series.map((entry) => (
          <PlayoffSeriesCard
            key={entry.seriesLetter}
            series={entry}
            currentGames={currentGames}
            weekGames={weekGames}
          />
        ))}
      </div>
    </div>
  );
}

export default function HomepagePlayoffBracket({
  currentDate,
  games,
  playoffBracket,
  playoffWeekGames
}: HomepagePlayoffBracketProps) {
  const series = playoffBracket.series ?? [];
  const westRoundOne = getSeriesGroup(series, WEST_ROUND_ONE_LETTERS);
  const eastRoundOne = getSeriesGroup(series, EAST_ROUND_ONE_LETTERS);
  const westRoundTwo = getSeriesGroup(series, WEST_ROUND_TWO_LETTERS);
  const eastRoundTwo = getSeriesGroup(series, EAST_ROUND_TWO_LETTERS);
  const westFinal = getSeriesByLetter(series, WEST_FINAL_LETTER);
  const eastFinal = getSeriesByLetter(series, EAST_FINAL_LETTER);
  const cupFinal = getSeriesByLetter(series, CUP_FINAL_LETTER);
  const formattedDate = moment(currentDate).format("ddd, MMM D");

  return (
    <div className={styles.playoffBracket}>
      <div className={styles.playoffHeader}>
        <span className={styles.playoffEyebrow}>Today&apos;s matchups</span>
        <div className={styles.playoffHeaderMeta}>
          <span className={styles.playoffDate}>{formattedDate}</span>
          <span className={styles.playoffCount}>
            {games.length} game{games.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      <TodaySeriesRail games={playoffWeekGames.length > 0 ? playoffWeekGames : games} />

      <div className={styles.bracketBrand}>
        {playoffBracket.bracketLogo ? (
          <OptimizedImage
            src={playoffBracket.bracketLogo}
            alt="Stanley Cup Playoffs bracket"
            className={styles.bracketLogo}
            width={420}
            height={80}
            unoptimized
            fallbackSrc={fallbackNHLLogo}
          />
        ) : (
          <h2 className={styles.bracketTitle}>Stanley Cup Playoffs</h2>
        )}
      </div>

      <div className={styles.bracketBoard}>
        <section className={`${styles.conferenceBoard} ${styles.westBoard}`}>
          <div className={styles.conferenceHeading}>Western Conference</div>
          <div className={styles.conferenceColumns}>
            <RoundColumn
              title="R1"
              roundKey="roundOne"
              series={westRoundOne}
              currentGames={games}
              weekGames={playoffWeekGames}
            />
            <RoundColumn
              title="R2"
              roundKey="roundTwo"
              series={westRoundTwo}
              currentGames={games}
              weekGames={playoffWeekGames}
              align="middle"
            />
            <RoundColumn
              title="CF"
              roundKey="conferenceFinal"
              series={westFinal ? [westFinal] : []}
              currentGames={games}
              weekGames={playoffWeekGames}
              align="center"
            />
          </div>
        </section>

        <section className={styles.cupBoard}>
          <span className={styles.roundLabel}>SCF</span>
          {cupFinal ? <PlayoffSeriesCard series={cupFinal} currentGames={games} weekGames={playoffWeekGames} /> : null}
        </section>

        <section className={`${styles.conferenceBoard} ${styles.eastBoard}`}>
          <div className={styles.conferenceHeading}>Eastern Conference</div>
          <div className={`${styles.conferenceColumns} ${styles.eastColumns}`}>
            <RoundColumn
              title="CF"
              roundKey="conferenceFinal"
              series={eastFinal ? [eastFinal] : []}
              currentGames={games}
              weekGames={playoffWeekGames}
              align="center"
            />
            <RoundColumn
              title="R2"
              roundKey="roundTwo"
              series={eastRoundTwo}
              currentGames={games}
              weekGames={playoffWeekGames}
              align="middle"
            />
            <RoundColumn
              title="R1"
              roundKey="roundOne"
              series={eastRoundOne}
              currentGames={games}
              weekGames={playoffWeekGames}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
