// components/GameGrid/TeamRow.tsx

import Image from "next/image";
import { formatWinOdds } from "./utils/calcWinOdds";
import { formatWeekScore } from "./utils/calcWeekScore";
import { useTeam } from "./contexts/GameGridContext";
import {
  DAYS,
  DAY_ABBREVIATION,
  EXTENDED_DAYS,
  GameData,
  WeekData,
} from "lib/NHL/types";
import Tooltip from "./PDHC/Tooltip";
import PoissonHeatmap from "./PDHC/PoissonHeatMap";
// import { getTeamAbbreviation } from "lib/teamsInfo"; // Import the helper function
import { useTeamAbbreviation } from "hooks/useTeamAbbreviation";

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
  home: boolean;
} & Pick<GameData, "homeTeam" | "awayTeam">;

function MatchUpCell({ home, homeTeam, awayTeam }: MatchUpCellProps) {
  const us = home ? homeTeam : awayTeam;
  const opponent = home ? awayTeam : homeTeam;

  // Unconditionally call useTeam for both teams
  const usTeam = useTeam(us.id);
  const opponentTeam = useTeam(opponent.id);

  // Retrieve abbreviations
  const usAbbreviation = useTeamAbbreviation(us.id);
  const opponentAbbreviation = useTeamAbbreviation(opponent.id);

  console.log(
    `MatchUpCell: usAbbreviation=${usAbbreviation}, opponentAbbreviation=${opponentAbbreviation}`
  );

  // Handle cases where abbreviation might not be found
  if (!usAbbreviation || !opponentAbbreviation) {
    console.error(
      `Abbreviation not found for team IDs: ${us.id}, ${opponent.id}`
    );
    return <div>Data unavailable</div>; // Fallback UI
  }

  // Proceed with rendering since hooks are called unconditionally
  const hasResult = us.score !== undefined && opponent.score !== undefined;
  let text = "";
  let stat = "";

  // Game with result
  if (hasResult) {
    const win = us.score > opponent.score;
    text = win ? "WIN" : "LOSS";
    stat = `${us.score}-${opponent.score}`;
  }
  // Game without result, display home/away
  else {
    text = home ? "HOME" : "AWAY";
    stat = formatWinOdds(us.winOdds ?? 0);
  }

  console.log(`MatchUpCell: text=${text}, stat=${stat}`);

  // Define tooltipContent within MatchUpCell
  const tooltipContent = (
    <div>
      <h4>Poisson Distribution Heatmap</h4>
      <p>Most likely game outcome based on team statistics.</p>
      <PoissonHeatmap
        homeTeamAbbreviation={usAbbreviation}
        awayTeamAbbreviation={opponentAbbreviation}
        situation="5v5" // Replace with dynamic situation if available
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
