import Image from "next/image";
import { formatWinOdds } from "./utils/calcWinOdds";
import { formatWeekScore } from "./utils/calcWeekScore";
import {
  DAYS,
  EXTENDED_DAYS,
  GameData,
  WeekData,
} from "pages/api/v1/schedule/[startDate]";
import { useTeam } from "./contexts/GameGridContext";

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
  return (
    <tr className={styles.teamRow}>
      {/* Team Name */}
      <td>
        <span className={styles.teamName}>{team.abbreviation}</span>
        <span className={styles.teamAbbreviation}>{team.abbreviation}</span>
      </td>
      {/* Days */}
      {days.map((day) => {
        const matchUp = props[day];
        const hasMatchUp_ = matchUp !== undefined;
        return (
          <td
            key={day}
            // style={cellData?.offNight ? { backgroundColor: "#505050" } : {}}
          >
            {hasMatchUp_ ? (
              <MatchUpCell
                key={day}
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
    </tr>
  );
}

type MatchUpCellProps = {
  home: boolean;
} & Pick<GameData, "homeTeam" | "awayTeam">;

function MatchUpCell({ home, homeTeam, awayTeam }: MatchUpCellProps) {
  const us = home ? homeTeam : awayTeam;
  const opponent = home ? awayTeam : homeTeam;
  const opponentTeam = useTeam(opponent.id);
  const hasResult = us.score !== undefined && opponent.score !== undefined;
  let text = "";
  let stat = "";

  // game with result
  if (hasResult) {
    const win = us.score > opponent.score;
    text = win ? "WIN" : "LOSS";
    stat = `${us.score}-${opponent.score}`;
  }
  // game without result, display home/away
  else {
    text = home ? "HOME" : "AWAY";
    stat = formatWinOdds(us.winOdds ?? 0);
  }

  return (
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
  );
}

export default TeamRow;
