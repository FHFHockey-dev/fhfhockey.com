import { formatWinOdds } from "./utils/calcWinOdds";
import { formatWeekScore } from "./utils/calcWeekScore";
import styles from "./GameGrid.module.css";

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

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

function TeamRow(props: TeamRowData) {
  return (
    <tr>
      {/* Team Name */}
      <td>{props.teamName}</td>
      {/* Days */}
      {DAYS.map((day) => {
        // @ts-ignore
        const cellData = props[day] as MatchUpCellData | undefined;
        const hasMatchUp_ = cellData && hasMatchUp(cellData);
        return (
          <td
            key={day}
            style={cellData?.offNight ? { backgroundColor: "#505050" } : {}}
          >
            {hasMatchUp_ ? <MatchUpCell key={day} {...cellData} /> : "-"}
          </td>
        );
      })}

      {/* Total Games Played */}
      <td>{props.totalGamesPlayed}</td>
      {/* Total Off-Nights */}
      <td>{props.totalOffNights}</td>
      {/* Week Score */}
      <td>
        {props.weekScore === -100 ? "-" : formatWeekScore(props.weekScore)}
      </td>
    </tr>
  );
}

function MatchUpCell({
  home,
  away,
  win,
  loss,
  logo,
  opponentName,
  score,
  winOdds,
}: MatchUpCellData) {
  let text = "";
  let stat = "";
  // game with result
  if (win || loss) {
    text = win ? "WIN" : "LOSS";
    stat = score;
  }
  // game without result, display home/away
  else {
    text = home ? "HOME" : "AWAY";
    stat = formatWinOdds(winOdds);
  }

  return (
    <div style={{ display: "flex" }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          marginRight: "4px",
        }}
      >
        <span className={styles.homeAway}>{text}</span>
        <p className={styles.score}>{stat}</p>
      </div>
      <img
        alt={`${opponentName} logo`}
        width={30}
        height={30}
        src={logo}
        title={opponentName}
      />
    </div>
  );
}

/**
 * Test if the match up exist.
 * If a match up does not exist, then its home and away will both be false.
 * @param matchUp A match up.
 * @returns true if the match up exist, otherwise false.
 */
function hasMatchUp(matchUp: MatchUpCellData) {
  return matchUp?.away || matchUp?.home;
}

export default TeamRow;
