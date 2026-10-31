import { CREASE_SHIFT_SHOWN, creaseShiftWindowLabel, type CreaseShiftData, type CreaseShiftSettings, type CreaseShiftTeam } from "lib/socialShare/modules/creaseShift";
import type { SharePostCardProps } from "lib/socialShare/modules/contract";
import { PostEmpty, PostTable, PostTeamMark, type PostColumn } from "./kit";
import styles from "./CreaseShiftCard.module.scss";

const percent = (share: number | null) => share === null ? "—" : `${Math.round(share * 100)}%`;
const signed = (value: number | null) => value === null ? "—" : `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(Math.round(value))}`;
const lines = (team: CreaseShiftTeam, cell: (goalie: CreaseShiftTeam["goalies"][number]) => string | number) => <span className={styles.lines}>{team.goalies.map(goalie => <span key={goalie.goalieId}>{cell(goalie)}</span>)}</span>;
const crease = (team: CreaseShiftTeam) => team.startersUsed > 1 ? `Split, ${team.startersUsed} starters` : team.startersUsed === 1 ? "One starter" : "—";

export default function CreaseShiftCard({ data, logos }: SharePostCardProps<CreaseShiftSettings, CreaseShiftData>) {
  const ranked = data.teams.filter(team => team.rank !== null), shown = ranked.slice(0, CREASE_SHIFT_SHOWN), withheld = data.teams.filter(team => team.rank === null);
  if (!ranked.length) return <PostEmpty>No team has both windows resolved</PostEmpty>;
  const compared = data.comparison === "std" ? "STD" : "PREV";
  const columns: PostColumn<CreaseShiftTeam>[] = [
    { id: "rank", label: "RK", numeric: true, cell: team => team.rank },
    { id: "team", label: "TEAM", cell: team => <span className={styles.team}><PostTeamMark team={team.team} logo={logos[team.team]} size={28} /><span><b>{team.team}</b><small>{crease(team)}</small></span></span> },
    { id: "goalie", label: "GOALIE", cell: team => lines(team, goalie => `${goalie.name ?? goalie.goalieId}${goalie.otherTeams.length ? ` (also ${goalie.otherTeams.join(", ")})` : ""}`) },
    { id: "starts", label: "GS / GP", numeric: true, cell: team => lines(team, goalie => `${goalie.starts}/${creaseShiftWindowLabel(team, data.window)}`) },
    { id: "relief", label: "RELIEF", numeric: true, cell: team => lines(team, goalie => goalie.relief) },
    { id: "share", label: "SHARE", numeric: true, cell: team => lines(team, goalie => percent(goalie.share)) },
    { id: "comparison", label: compared, numeric: true, cell: team => lines(team, goalie => `${percent(goalie.comparisonShare)} (${goalie.comparisonStarts ?? "—"}/${team.comparisonGames})`) },
    { id: "change", label: "PTS", numeric: true, cell: team => lines(team, goalie => signed(goalie.change)) },
  ];
  return <div className={styles.card}>
    <p className={styles.note}>Official starts ÷ completed team games through {data.through}. Relief is counted apart. Describes past starts only.</p>
    <PostTable columns={columns} rows={shown} rowKey={team => team.team} />
    <p className={styles.note}>
      {data.comparison === "std" ? `STD is season to date and contains each team's recent games. ` : `PREV is the ${data.window} games before the window, with no shared game. `}
      PTS is share change in percentage points.
      {ranked.length > shown.length ? ` Showing ${shown.length} of ${ranked.length} ranked teams.` : ""}
      {withheld.length ? ` Unranked: ${withheld.map(team => team.team).join(", ")}.` : ""}
    </p>
  </div>;
}
