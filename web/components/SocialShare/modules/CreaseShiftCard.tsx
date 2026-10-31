import { Fragment } from "react";
import { CREASE_SHIFT_SHOWN, creaseColors, creaseShiftWindowLabel, type CreaseShiftData, type CreaseShiftGoalie, type CreaseShiftSettings, type CreaseShiftTeam } from "lib/socialShare/modules/creaseShift";
import type { SharePostCardProps } from "lib/socialShare/modules/contract";
import { PostEmpty, PostTeamMark } from "./kit";
import styles from "./CreaseShiftCard.module.scss";

const percent = (share: number | null) => share === null ? "—" : `${Math.round(share * 100)}%`;
const signed = (value: number | null) => value === null ? "—" : `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(Math.round(value))}`;
const crease = (team: CreaseShiftTeam) => team.startersUsed > 1 ? `Split, ${team.startersUsed} starters` : team.startersUsed === 1 ? "One starter" : "—";
/** Fewer ranked teams get larger type and a taller chart, so the rows fill the body rather than leaving a band under them. */
const ROWS_HEIGHT = 803, ROW_CHROME = 8;
const sizeFor = (rows: number) => {
  const chartHeight = Math.min(200, Math.floor(ROWS_HEIGHT / rows) - ROW_CHROME);
  return rows <= 6 ? { name: "large", logo: 50, chartWidth: 420, chartHeight } : rows <= 9 ? { name: "medium", logo: 40, chartWidth: 460, chartHeight } : { name: "small", logo: 30, chartWidth: 500, chartHeight };
};
const OTHER_STARTER = "#9aa3ad";
/** G1 and G2 in the team's colours, by most starts in the window; any other starter is neutral grey and dashed. */
function goalieColor(team: CreaseShiftTeam, goalie: CreaseShiftGoalie) {
  const index = team.goalies.filter(entry => entry.starts > 0).indexOf(goalie), colors = creaseColors(team.team);
  return index === 0 ? colors.g1 : index === 1 ? colors.g2 : index > 1 ? OTHER_STARTER : undefined;
}

const PAD = 5, BLOCK_GAP = 3;
/** One block per game and each starter's rolling share above it, on a fixed 0 to 100% scale, so a point sits over the last game it counts. Colours are attributes: html-to-image drops class styles on SVG children. */
function CreaseChart({ team, span, width, height }: { team: CreaseShiftTeam; span: number; width: number; height: number }) {
  const slot = width / Math.max(team.series.length, 1), blockHeight = Math.min(30, Math.max(11, Math.round(height * 0.2))), blockTop = height - blockHeight, plotHeight = blockTop - BLOCK_GAP;
  const x = (index: number) => (index + 0.5) * slot, y = (share: number) => plotHeight - PAD - share * (plotHeight - 2 * PAD);
  const starters = team.goalies.filter(goalie => goalie.starts > 0).reverse(), name = (id: number | null) => team.goalies.find(goalie => goalie.goalieId === id)?.name ?? id ?? "no resolved starter";
  return <svg className={styles.chart} width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img"
    aria-label={`${team.team}, starter by game, oldest to newest: ${team.series.map(point => name(point.starterId)).join(", ")}. Start share over ${span} games: ${starters.slice().reverse().map(goalie => `${goalie.name ?? goalie.goalieId} ${goalie.rolling.flatMap(value => value === null ? [] : [`${Math.round(value * 100)}%`]).join(", ")}`).join("; ")}`}>
    {[1, 0.5, 0].map(share => <line key={share} x1={0} x2={width} y1={y(share)} y2={y(share)} stroke="#ffffff" strokeOpacity="0.14" strokeWidth="1" strokeDasharray={share === 0.5 ? "2 3" : undefined} />)}
    {starters.map(goalie => {
      const color = goalieColor(team, goalie)!, plotted = goalie.rolling.flatMap((value, index) => value === null ? [] : [{ value, index }]);
      // A break in the values is a break in the line: nothing bridges an unresolved game.
      const d = plotted.map(({ value, index }, order) => `${order && plotted[order - 1].index === index - 1 ? "L" : "M"}${x(index).toFixed(1)} ${y(value).toFixed(1)}`).join("");
      const dots = plotted.filter(({ index }, order) => order === plotted.length - 1 || (goalie.rolling[index - 1] == null && goalie.rolling[index + 1] == null));
      return <g key={goalie.goalieId} data-goalie={goalie.goalieId} data-values={goalie.rolling.map(value => value ?? "gap").join(",")} data-color={color}>
        {d && <path d={d} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" strokeDasharray={color === OTHER_STARTER ? "4 3" : undefined} />}
        {dots.map(({ value, index }) => <circle key={index} cx={x(index)} cy={y(value)} r="3" fill={color} />)}
      </g>;
    })}
    {team.series.map((point, index) => {
      const starter = team.goalies.find(goalie => goalie.goalieId === point.starterId), color = starter && goalieColor(team, starter);
      const box = { x: index * slot + 1.5, y: blockTop + 0.5, width: Math.max(slot - 3, 1), height: blockHeight - 1, rx: 2 };
      return color ? <rect key={point.gameId} {...box} fill={color} data-block="started" data-starter={point.starterId ?? undefined} />
        : <rect key={point.gameId} {...box} fill="none" stroke="#ffffff" strokeOpacity="0.45" strokeWidth="1" data-block="empty" />;
    })}
  </svg>;
}

export default function CreaseShiftCard({ data, logos }: SharePostCardProps<CreaseShiftSettings, CreaseShiftData>) {
  const ranked = data.teams.filter(team => team.rank !== null), shown = ranked.slice(0, CREASE_SHIFT_SHOWN);
  if (!ranked.length) return <PostEmpty>No team has both windows resolved with {data.minComparisonGames} comparison games</PostEmpty>;
  const size = sizeFor(shown.length), compared = data.comparison === "std" ? "STD" : "PREV";
  // Relief has no column, so a goalie with no start in either window has nothing to show here.
  const lines = (team: CreaseShiftTeam, cell: (goalie: CreaseShiftGoalie) => string | number, colored = false) => <span className={styles.lines}>{team.goalies.filter(goalie => goalie.starts > 0 || (goalie.comparisonStarts ?? 0) > 0).map(goalie => {
    const color = colored ? goalieColor(team, goalie) : undefined;
    return <span key={goalie.goalieId} style={color ? { color } : undefined} data-goalie-color={color}>{cell(goalie)}</span>;
  })}</span>;
  const heads = ["RK", "TEAM", "GOALIE", "SHARE", compared, "PTS", `BY GAME · ROLLING ${data.rollingSpan}`];
  return <div className={styles.card} data-testid="crease-shift-card" data-size={size.name}>
    <div className={styles.table} style={{ gridTemplateRows: `auto repeat(${shown.length}, minmax(min-content, 1fr))` }}>
      {heads.map((head, index) => <span key={head} className={styles.head} data-left={index === 1 || index === 2 || index === 6 || undefined}>{head}</span>)}
      {shown.map(team => <Fragment key={team.team}>
        <span className={styles.cell} data-testid="crease-shift-rank"><b>{team.rank}</b></span>
        <span className={styles.cell} data-left=""><span className={styles.team}><PostTeamMark team={team.team} logo={logos[team.team]} size={size.logo} /><span><b>{team.team}</b><small>{crease(team)}</small></span></span></span>
        <span className={styles.cell} data-left="">{lines(team, goalie => `${goalie.name ?? goalie.goalieId}${goalie.otherTeams.length ? ` (also ${goalie.otherTeams.join(", ")})` : ""}`, true)}</span>
        <span className={styles.cell}>{lines(team, goalie => percent(goalie.share), true)}</span>
        <span className={styles.cell}>{lines(team, goalie => percent(goalie.comparisonShare))}</span>
        <span className={styles.cell}>{lines(team, goalie => signed(goalie.change))}</span>
        <span className={styles.cell}><CreaseChart team={team} span={data.rollingSpan} width={size.chartWidth} height={size.chartHeight} /></span>
      </Fragment>)}
    </div>
    <p className={styles.note}>Blocks: who started each game, oldest to newest; empty means no resolved starter. Lines: start share over the last {data.rollingSpan} games, from game {data.rollingSpan}, with guides at 0, 50 and 100%. Official starts ÷ completed team games, through {data.through}; relief is not a start. {data.comparison === "std" ? "STD is season to date and includes these games." : `PREV is up to the ${data.window} games before.`} PTS is the share change. Describes past starts only.</p>
  </div>;
}
