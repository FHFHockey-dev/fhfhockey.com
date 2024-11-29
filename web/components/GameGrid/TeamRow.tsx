// components/GameGrid/TeamRow.tsx

import Image from "next/image";
import { formatWinOdds, calculateBlendedWinOdds } from "./utils/calcWinOdds";
import { formatWeekScore } from "./utils/calcWeekScore";
import { useTeam } from "./contexts/GameGridContext";
import {
  DAYS,
  DAY_ABBREVIATION,
  EXTENDED_DAYS,
  GameData,
  WeekData,
  ExtendedWeekData
} from "lib/NHL/types";
import Tooltip from "./PDHC/Tooltip";
import PoissonHeatmap from "./PDHC/PoissonHeatMap";
import styles from "./GameGrid.module.scss";

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
   * to signify what I call an “Off-Night”
   */
  offNight: boolean;
};

export type TeamRowData = {
  teamName: string;
  teamAbbreviation: string;
  Mon?: MatchUpCellData;
  Tue?: MatchUpCellData;
  Wed?: MatchUpCellData;
  Thu?: MatchUpCellData;
  Fri?: MatchUpCellData;
  Sat?: MatchUpCellData;
  Sun?: MatchUpCellData;
  totalGamesPlayed: number;
  totalOffNights: number;
  weekScore: number;
  [key: string]: any;
};

type TeamRowProps = {
  teamId: number;
  totalGamesPlayed: number;
  totalOffNights: number;
  weekScore: number;
  extended: boolean;
  excludedDays: DAY_ABBREVIATION[];
} & WeekData;

function getGamesPlayedClass(totalGamesPlayed: number): string {
  if (totalGamesPlayed <= 1) return styles.redBorder;
  if (totalGamesPlayed === 2) return styles.orangeBorder;
  if (totalGamesPlayed === 3) return styles.yellowBorder;
  return styles.greenBorder;
}

function getOffNightsClass(totalOffNights: number): string {
  if (totalOffNights === 0) return styles.redBorder;
  if (totalOffNights === 1) return styles.orangeBorder;
  if (totalOffNights === 2) return styles.yellowBorder;
  return styles.greenBorder;
}

function TeamRow(props: TeamRowProps) {
  const team = useTeam(props.teamId);
  const days = props.extended ? EXTENDED_DAYS : DAYS;

  // Handle cases where team data might not be loaded yet
  if (!team) {
    return (
      <tr className={styles.teamRow}>
        <td colSpan={days.length + 4}>Loading team data...</td>
      </tr>
    );
  }

  return (
    <tr className={styles.teamRow}>
      {/* Team Name */}
      <td>
        <span className={styles.teamName}>
          {team.abbreviation}
          {"    "}
          <Image
            className={`${styles.mobileLogoSize}`}
            objectFit="contain"
            alt={`${team.name} logo`}
            width={35}
            height={35}
            src={team.logo}
            title={team.name}
          />
          {"    "}
        </span>
        <span className={styles.teamAbbreviation}>{team.abbreviation}</span>
      </td>
      {/* Days */}
      {days.map((day) => {
        const matchUp = props[day];
        const hasMatchUp_ = matchUp !== undefined;
        // @ts-ignore
        const excluded = props.excludedDays.includes(day);
        return (
          <td
            key={day}
            style={
              !props.extended && excluded ? { backgroundColor: "#505050" } : {}
            }
          >
            {hasMatchUp_ ? (
              <MatchUpCell
                key={day}
                gameId={matchUp.id} // Pass gameId here
                home={matchUp.homeTeam.id === props.teamId}
                homeTeam={matchUp.homeTeam}
                awayTeam={matchUp.awayTeam}
              />
            ) : (
              "-"
            )}
          </td>
        );
      })}
      {!props.extended && (
        <>
          {/* Total Games Played */}
          <td className={getGamesPlayedClass(props.totalGamesPlayed)}>
            {props.totalGamesPlayed}
          </td>
          {/* Total Off-Nights */}
          <td className={getOffNightsClass(props.totalOffNights)}>
            {props.totalOffNights}
          </td>
          {/* Week Score */}
          <td>
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
  situation?: "home" | "away";
};

function MatchUpCell({ home, homeTeam, awayTeam, gameId }: MatchUpCellProps) {
  const us = home ? homeTeam : awayTeam;
  const opponent = home ? awayTeam : homeTeam;

  // Fetch combined team data from context
  const usTeam = useTeam(us.id);
  const opponentTeam = useTeam(opponent.id);

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
    text = home ? "HOME" : "AWAY";
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
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div className={styles.scoreAndHomeAway}>
          <span className={styles.homeAway}>{text}</span>
          <p className={styles.score}>{stat}</p>
        </div>
        <div
          className={`${styles.hideOnMobile}`}
          style={{ paddingRight: "3px", margin: "auto", fontSize: "0.75rem" }}
        >
          {home ? "vs." : "@"}
        </div>
        <Image
          className={`${styles.mobileLogoSize}`}
          objectFit="contain"
          alt={`${opponentTeam.name} logo`}
          width={35}
          height={35}
          src={opponentTeam.logo}
          title={opponentTeam.name}
        />
      </div>
    </Tooltip>
  );
}

export default TeamRow;
