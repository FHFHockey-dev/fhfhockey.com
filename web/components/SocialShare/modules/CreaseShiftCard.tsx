import { Fragment } from "react";
import { CREASE_SHIFT_SHOWN, creaseColors, creaseShiftWindowLabel, type CreaseShiftData, type CreaseShiftGoalie, type CreaseShiftSettings, type CreaseShiftTeam } from "lib/socialShare/modules/creaseShift";
import type { SharePostCardProps } from "lib/socialShare/modules/contract";
import { PostEmpty, PostTeamMark } from "./kit";
import styles from "./CreaseShiftCard.module.scss";

const percent = (share: number | null) => share === null ? "—" : `${Math.round(share * 100)}%`;
const signed = (value: number | null) => value === null ? "—" : `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(Math.round(value))}`;
const crease = (team: CreaseShiftTeam) => team.startersUsed > 1 ? `Split, ${team.startersUsed} starters` : team.startersUsed === 1 ? "One starter" : "—";
/** Fewer ranked teams get larger type and a taller line, so the rows fill the body rather than leaving a band under them. */
const sizeFor = (rows: number) => rows <= 6 ? { name: "large", logo: 50, lineHeight: 110 } : rows <= 9 ? { name: "medium", logo: 40, lineHeight: 72 } : { name: "small", logo: 30, lineHeight: 50 };
const OTHER_STARTER = "#9aa3ad";
/** G1 and G2 in the team's colours, by most starts in the window; any other starter is neutral grey and dashed. */
function goalieColor(team: CreaseShiftTeam, goalie: CreaseShiftGoalie) {
  const index = team.goalies.filter(entry => entry.starts > 0).indexOf(goalie), colors = creaseColors(team.team);
  return index === 0 ? colors.g1 : index === 1 ? colors.g2 : index > 1 ? OTHER_STARTER : undefined;
}

const LINE_WIDTH = 170, PAD = 6;
/** Each starter's start share so far, game by game, on a fixed 0 to 100% scale. Colours are attributes: html-to-image drops class styles on SVG children. */
function ShareLine({ team, height }: { team: CreaseShiftTeam; height: number }) {
  const count = team.series.length, x = (index: number) => count === 1 ? LINE_WIDTH / 2 : PAD + index * (LINE_WIDTH - 2 * PAD) / (count - 1), y = (share: number) => height - PAD - share * (height - 2 * PAD);
  const starters = team.goalies.filter(goalie => goalie.starts > 0).reverse();
  return <svg className={styles.line} width={LINE_WIDTH} height={height} viewBox={`0 0 ${LINE_WIDTH} ${height}`} role="img"
    aria-label={`${team.team}, start share so far by game: ${starters.slice().reverse().map(goalie => `${goalie.name ?? goalie.goalieId} ${goalie.series.map(value => value === null ? "gap" : `${Math.round(value * 100)}%`).join(", ")}`).join("; ")}`}>
    <line x1={PAD} x2={LINE_WIDTH - PAD} y1={y(1)} y2={y(1)} stroke="#ffffff" strokeOpacity="0.14" strokeWidth="1" />
    <line x1={PAD} x2={LINE_WIDTH - PAD} y1={y(0.5)} y2={y(0.5)} stroke="#ffffff" strokeOpacity="0.14" strokeWidth="1" strokeDasharray="2 3" />
    <line x1={PAD} x2={LINE_WIDTH - PAD} y1={y(0)} y2={y(0)} stroke="#ffffff" strokeOpacity="0.14" strokeWidth="1" />
    {team.series.map((point, index) => point.state === "resolved" ? null : <path key={point.gameId} d={`M${x(index).toFixed(1)} ${(height - 3).toFixed(1)}v-4`} stroke="#ffffff" strokeOpacity="0.6" strokeWidth="1.5" data-gap="" />)}
    {starters.map(goalie => {
      const color = goalieColor(team, goalie)!, plotted = goalie.series.flatMap((value, index) => value === null ? [] : [{ value, index }]);
      const d = plotted.map(({ value, index }, order) => `${order ? "L" : "M"}${x(index).toFixed(1)} ${y(value).toFixed(1)}`).join("");
      const last = plotted[plotted.length - 1];
      return <g key={goalie.goalieId} data-goalie={goalie.goalieId} data-values={goalie.series.map(value => value ?? "gap").join(",")} data-color={color}>
        <path d={d} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" strokeDasharray={color === OTHER_STARTER ? "4 3" : undefined} />
        {last && <circle cx={x(last.index)} cy={y(last.value)} r="3" fill={color} />}
      </g>;
    })}
  </svg>;
}

export default function CreaseShiftCard({ data, logos }: SharePostCardProps<CreaseShiftSettings, CreaseShiftData>) {
  const ranked = data.teams.filter(team => team.rank !== null), shown = ranked.slice(0, CREASE_SHIFT_SHOWN);
  if (!ranked.length) return <PostEmpty>No team has both windows resolved with {data.minComparisonGames} comparison games</PostEmpty>;
  const size = sizeFor(shown.length), compared = data.comparison === "std" ? "STD" : "PREV";
  const lines = (team: CreaseShiftTeam, cell: (goalie: CreaseShiftGoalie) => string | number, colored = false) => <span className={styles.lines}>{team.goalies.map(goalie => {
    const color = colored ? goalieColor(team, goalie) : undefined;
    return <span key={goalie.goalieId} style={color ? { color } : undefined} data-goalie-color={color}>{cell(goalie)}</span>;
  })}</span>;
  const heads = ["RK", "TEAM", "GOALIE", "SHARE", "GS / GP", "RELIEF", compared, "PTS", "SHARE BY GAME"];
  return <div className={styles.card} data-testid="crease-shift-card" data-size={size.name}>
    <div className={styles.table} style={{ gridTemplateRows: `auto repeat(${shown.length}, minmax(min-content, 1fr))` }}>
      {heads.map((head, index) => <span key={head} className={styles.head} data-left={index === 1 || index === 2 || undefined}>{head}</span>)}
      {shown.map(team => <Fragment key={team.team}>
        <span className={styles.cell} data-testid="crease-shift-rank"><b>{team.rank}</b></span>
        <span className={styles.cell} data-left=""><span className={styles.team}><PostTeamMark team={team.team} logo={logos[team.team]} size={size.logo} /><span><b>{team.team}</b><small>{crease(team)}</small></span></span></span>
        <span className={styles.cell} data-left="">{lines(team, goalie => `${goalie.name ?? goalie.goalieId}${goalie.otherTeams.length ? ` (also ${goalie.otherTeams.join(", ")})` : ""}`, true)}</span>
        <span className={styles.cell}>{lines(team, goalie => percent(goalie.share), true)}</span>
        <span className={styles.cell}>{lines(team, goalie => `${goalie.starts}/${creaseShiftWindowLabel(team, data.window)}`)}</span>
        <span className={styles.cell}>{lines(team, goalie => goalie.relief)}</span>
        <span className={styles.cell}>{lines(team, goalie => `${percent(goalie.comparisonShare)} (${goalie.comparisonStarts ?? "—"}/${team.comparisonGames})`)}</span>
        <span className={styles.cell}>{lines(team, goalie => signed(goalie.change))}</span>
        <span className={styles.cell}><ShareLine team={team} height={size.lineHeight} /></span>
      </Fragment>)}
    </div>
    <p className={styles.note}>Official starts ÷ completed team games, through {data.through}. {data.comparison === "std" ? "STD is season to date and includes these games." : `PREV is the ${data.window} games before.`} PTS is the share change. The line is share so far, game by game. Describes past starts only.</p>
  </div>;
}
