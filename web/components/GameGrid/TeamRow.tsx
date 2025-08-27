// components/GameGrid/TeamRow.tsx

import Image from "next/legacy/image";
import { formatWinOdds, calculateBlendedWinOdds } from "./utils/calcWinOdds";
import { formatWeekScore } from "./utils/calcWeekScore";
import { useTeam } from "./contexts/GameGridContext";
import {
  DAYS,
  DAY_ABBREVIATION,
  EXTENDED_DAYS,
  GameData,
  WeekData
} from "lib/NHL/types";
import Tooltip from "./PDHC/Tooltip";
import PoissonHeatmap from "./PDHC/PoissonHeatMap";
import styles from "./GameGrid.module.scss";
import clsx from "clsx";
import { useEffect, useState } from "react";

export type MatchUpCellData = {
  home: boolean;
  away: boolean;
  /**
   * URL, the opponent's team logo.
   */
  logo: string;
  opponentName: string;
  win: boolean;
  loss: boolean;
  /**
   * The game score. e.g., 5-2
   */
  score: string;
  /**
   * The win odds of a game. A number between -5 and 5.
   * e.g., 0.51, -1.06
   */
  winOdds: number;
  /**
   * if the total # of games played that day was <=8
   * to signify what I call an "Off-Night"
   */
  offNight: boolean;
};

type TeamRowProps = {
  teamId: number;
  totalGamesPlayed: number;
  totalOffNights: number;
  weekScore: number;
  extended: boolean;
  excludedDays: DAY_ABBREVIATION[];
  rowHighlightClass?: string;
  games: number[];
  rank: number;
} & WeekData;

function getGamesPlayedIntensity(totalGamesPlayed: number): string {
  if (totalGamesPlayed <= 1) return "low";
  if (totalGamesPlayed === 2) return "medium-low";
  if (totalGamesPlayed === 3) return "medium-high";
  return "high";
}

function getOffNightsIntensity(totalOffNights: number): string {
  if (totalOffNights === 0) return "low";
  if (totalOffNights === 1) return "medium-low";
  if (totalOffNights === 2) return "medium-high";
  return "high";
}

// Simple hook to detect mobile (<=480px)
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 480);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isMobile;
}

function TeamRow(props: TeamRowProps) {
  const team = useTeam(props.teamId);
  const days = props.extended ? EXTENDED_DAYS : DAYS;
  const isMobile = useIsMobile();

  // Handle cases where team data might not be loaded yet
  if (!team) {
    return (
      <tr className={`${styles.teamRow} ${props.rowHighlightClass || ""}`}></tr>
    );
  }

  return (
    <tr className={clsx(styles.teamRow, props.rowHighlightClass)}>
      {/* First column: show abbreviation on desktop, logo on mobile */}
      <td className={styles.firstColumnContent}>
        <span className={styles.desktopTeamAbbreviation}>
          {team.abbreviation}
        </span>
        <span className={styles.mobileTeamLogo}>
          <Image
            objectFit="contain"
            alt={`${team.name} logo`}
            width={24}
            height={24}
            src={team.logo}
            title={team.name}
            className={styles.teamLogo24}
          />
        </span>
      </td>
      {/* Days */}
      {days.map((day, index) => {
        if (!DAYS.includes(day as DAY_ABBREVIATION)) return null;

        const matchUp = props[day];
        const hasMatchUp = matchUp !== undefined;
        const excluded = props.excludedDays.includes(day as DAY_ABBREVIATION);
        const numGamesThatDay = props.games[index] || 0;
        // Determine cell classes for inner border styling
        let dayIntensityClass = "";
        // if (hasMatchUp) {
        if (numGamesThatDay >= 9) {
          dayIntensityClass = styles["heavy-day"]; // Red border for heavy day matchup
        } else if (numGamesThatDay === 7) {
          dayIntensityClass = styles["medium-heavy-day"]; // Red border for heavy day matchup
        } else if (numGamesThatDay === 8) {
          dayIntensityClass = styles["medium-heavy-day"]; // Red border for heavy day matchup
        } else if (numGamesThatDay < 7) {
          dayIntensityClass = styles["off-night-day"]; // Green border for off-night matchup
        }

        let offNightTypeClass = "";
        // if (hasMatchUp) {
        //   offNightTypeClass =
        //     matchUp.homeTeam.id === props.teamId
        //       ? styles["off-night-home"]
        //       : styles["off-night-away"];
        // }

        // if (numGamesThatDay <= 8) {
        //   offNightTypeClass = styles["off-night-day"];
        // }

        const cellClasses = clsx(
          styles.cellInnerBorder,
          dayIntensityClass,
          offNightTypeClass
        );

        return (
          <td key={day} className={cellClasses}>
            {/* Excluded Day Overlay */}
            {!props.extended && excluded && !isMobile && (
              <div className={styles.excludedOverlay}></div>
            )}

            {hasMatchUp ? (
              <MatchUpCell
                key={day}
                gameId={matchUp.id}
                home={matchUp.homeTeam.id === props.teamId}
                homeTeam={matchUp.homeTeam}
                awayTeam={matchUp.awayTeam}
                excluded={excluded}
              />
            ) : isMobile ? (
              ""
            ) : (
              "-"
            )}
          </td>
        );
      })}

      {!props.extended && (
        <>
          {/* Total Games Played - Use data-attribute for styling */}
          <td data-intensity={getGamesPlayedIntensity(props.totalGamesPlayed)}>
            {props.totalGamesPlayed}
          </td>
          {/* Total Off-Nights - Use data-attribute for styling */}
          <td data-intensity={getOffNightsIntensity(props.totalOffNights)}>
            {props.totalOffNights}
          </td>
          {/* Week Score - Apply rank color class */}
          <td
            className={clsx(
              styles.weekScoreCell,
              styles[`rank-color-${props.rank}`]
            )}
          >
            {props.weekScore === -100 ? "-" : formatWeekScore(props.weekScore)}
          </td>
        </>
      )}
    </tr>
  );
}

type MatchUpCellProps = {
  gameId: number; // Add gameId here
  home: boolean;
  homeTeam: GameData["homeTeam"];
  awayTeam: GameData["awayTeam"];
  excluded?: boolean;
};

function MatchUpCell({
  home,
  homeTeam,
  awayTeam,
  gameId,
  excluded
}: MatchUpCellProps) {
  const us = home ? homeTeam : awayTeam;
  const opponent = home ? awayTeam : homeTeam;

  // Always call hooks at the top
  const usTeam = useTeam(us.id);
  const opponentTeam = useTeam(opponent.id);
  const isMobile = useIsMobile();

  // Handle cases where team data might not be found
  if (!usTeam || !opponentTeam) {
    console.error(`Team data not found for team IDs: ${us.id}, ${opponent.id}`);
    return <div>Data unavailable</div>;
  }

  // Proceed with rendering
  const hasResult = us.score !== undefined && opponent.score !== undefined;
  let text = "";
  let stat = "";

  if (hasResult) {
    const usScore = us.score!;
    const opponentScore = opponent.score!;
    const win = usScore > opponentScore;
    text = win ? "WIN" : "LOSS";
    stat = `${usScore}-${opponentScore}`;
  } else {
    // Calculate blended win odds
    const blendedWinOdds = calculateBlendedWinOdds(us.winOdds, us.apiWinOdds);
    stat = blendedWinOdds !== null ? formatWinOdds(blendedWinOdds) : "-";
  }

  // Define tooltipContent within MatchUpCell
  const tooltipContent = (
    <div>
      <PoissonHeatmap
        homeTeamId={home ? us.id : opponent.id}
        awayTeamId={home ? opponent.id : us.id}
        gameId={gameId} // Pass gameId to PoissonHeatmap
      />
    </div>
  );

  return (
    <Tooltip content={tooltipContent}>
      <div className={styles.matchupCell}>
        {isMobile ? (
          <div
            className={clsx(
              styles.logoWithIconWrapper,
              styles.mobileMatchupLogoWrapper
            )}
          >
            <span
              className={clsx(
                styles.cornerBadge,
                home ? styles.homeBadge : styles.awayBadge
              )}
              aria-label={home ? "Home game" : "Away game"}
            >
              {home ? "H" : "A"}
            </span>
            <Image
              className={clsx(
                styles.mobileLogoSize,
                styles.compactMobileLogo,
                home ? styles["home-shadow"] : styles["away-shadow"],
                excluded ? styles.excludedStateMobile : undefined
              )}
              objectFit="contain"
              alt={`${opponentTeam.name} logo`}
              width={20}
              height={20}
              src={opponentTeam.logo}
              title={opponentTeam.name}
            />
          </div>
        ) : (
          <>
            <Image
              className={clsx(
                home ? styles["home-shadow"] : styles["away-shadow"],
                excluded ? styles.excludedStateDesktop : undefined
              )}
              objectFit="contain"
              alt={`${opponentTeam.name} logo`}
              width={28}
              height={28}
              src={opponentTeam.logo}
              title={opponentTeam.name}
            />
            <span className={styles.homeAwayIconDesktopWrapper}>
              <Image
                src={home ? "/pictures/homeIcon.png" : "/pictures/awayIcon.png"}
                alt={home ? "Home" : "Away"}
                width={18}
                height={18}
                className={styles.homeAwayIconDesktopImg}
              />
            </span>
          </>
        )}
      </div>
    </Tooltip>
  );
}

export default TeamRow;
