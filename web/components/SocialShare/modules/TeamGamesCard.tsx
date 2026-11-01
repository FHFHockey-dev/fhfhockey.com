import type { SharePostCardProps } from "lib/socialShare/modules/contract";
import type { TeamGamesData, TeamGamesRow, TeamGamesSettings } from "lib/socialShare/modules/teamGames";
import { PostEmpty, PostTable, PostTeamMark, type PostColumn } from "./kit";
import styles from "./TeamGamesCard.module.scss";

export default function TeamGamesCard({ data, logos }: SharePostCardProps<TeamGamesSettings, TeamGamesData>) {
  const columns: PostColumn<TeamGamesRow>[] = [
    { id: "rank", label: "RK", numeric: true, cell: row => row.rank },
    { id: "team", label: "TEAM", cell: row => <span className={styles.team}><PostTeamMark team={row.team} logo={logos[row.team]} size={28} />{row.team}</span> },
    { id: "games", label: "GP", numeric: true, cell: row => row.games },
  ];
  const half = Math.ceil(data.rows.length / 2);
  if (!data.rows.length) return <PostEmpty>No teams in this window</PostEmpty>;
  return <div className={styles.columns}>{[data.rows.slice(0, half), data.rows.slice(half)].map((rows, index) => <PostTable key={index} columns={columns} rows={rows} rowKey={row => row.team} />)}</div>;
}
