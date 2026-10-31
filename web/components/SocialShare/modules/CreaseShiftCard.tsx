import { Fragment } from "react";
import { CREASE_SHIFT_SHOWN, creaseShiftWindowLabel, type CreaseShiftData, type CreaseShiftSettings, type CreaseShiftTeam } from "lib/socialShare/modules/creaseShift";
import type { SharePostCardProps } from "lib/socialShare/modules/contract";
import { PostEmpty, PostTeamMark } from "./kit";
import styles from "./CreaseShiftCard.module.scss";

const percent = (share: number | null) => share === null ? "—" : `${Math.round(share * 100)}%`;
const signed = (value: number | null) => value === null ? "—" : `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(Math.round(value))}`;
const lines = (team: CreaseShiftTeam, cell: (goalie: CreaseShiftTeam["goalies"][number]) => string | number) => <span className={styles.lines}>{team.goalies.map(goalie => <span key={goalie.goalieId}>{cell(goalie)}</span>)}</span>;
const crease = (team: CreaseShiftTeam) => team.startersUsed > 1 ? `Split, ${team.startersUsed} starters` : team.startersUsed === 1 ? "One starter" : "—";
/** Fewer ranked teams get larger type, so the rows fill the body rather than leaving a band under them. */
const sizeFor = (rows: number) => rows <= 6 ? { name: "large", logo: 50 } : rows <= 9 ? { name: "medium", logo: 40 } : { name: "small", logo: 30 };

export default function CreaseShiftCard({ data, logos }: SharePostCardProps<CreaseShiftSettings, CreaseShiftData>) {
  const ranked = data.teams.filter(team => team.rank !== null), shown = ranked.slice(0, CREASE_SHIFT_SHOWN);
  if (!ranked.length) return <PostEmpty>No team has both windows resolved with {data.minComparisonGames} comparison games</PostEmpty>;
  const size = sizeFor(shown.length), compared = data.comparison === "std" ? "STD" : "PREV";
  const heads = ["RK", "TEAM", "GOALIE", "GS / GP", "RELIEF", "SHARE", compared, "PTS"];
  return <div className={styles.card} data-testid="crease-shift-card" data-size={size.name}>
    <div className={styles.table} style={{ gridTemplateRows: `auto repeat(${shown.length}, minmax(min-content, 1fr))` }}>
      {heads.map((head, index) => <span key={head} className={styles.head} data-left={index === 1 || index === 2 || undefined}>{head}</span>)}
      {shown.map(team => <Fragment key={team.team}>
        <span className={styles.cell} data-testid="crease-shift-rank"><b>{team.rank}</b></span>
        <span className={styles.cell} data-left=""><span className={styles.team}><PostTeamMark team={team.team} logo={logos[team.team]} size={size.logo} /><span><b>{team.team}</b><small>{crease(team)}</small></span></span></span>
        <span className={styles.cell} data-left="">{lines(team, goalie => `${goalie.name ?? goalie.goalieId}${goalie.otherTeams.length ? ` (also ${goalie.otherTeams.join(", ")})` : ""}`)}</span>
        <span className={styles.cell}>{lines(team, goalie => `${goalie.starts}/${creaseShiftWindowLabel(team, data.window)}`)}</span>
        <span className={styles.cell}>{lines(team, goalie => goalie.relief)}</span>
        <span className={styles.cell}>{lines(team, goalie => percent(goalie.share))}</span>
        <span className={styles.cell}>{lines(team, goalie => `${percent(goalie.comparisonShare)} (${goalie.comparisonStarts ?? "—"}/${team.comparisonGames})`)}</span>
        <span className={styles.cell}>{lines(team, goalie => signed(goalie.change))}</span>
      </Fragment>)}
    </div>
    <p className={styles.note}>Official starts ÷ completed team games, through {data.through}. {data.comparison === "std" ? "STD is season to date and includes these games." : `PREV is the ${data.window} games before.`} PTS is the share change. Describes past starts only.</p>
  </div>;
}
