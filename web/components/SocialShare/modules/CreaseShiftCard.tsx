import { Fragment, type ReactNode } from "react";
import { creaseColors, creaseShiftHasRows, creaseShiftShown, creaseShiftWords, type CreaseShiftData, type CreaseShiftGoalie, type CreaseShiftSettings, type CreaseShiftTeam } from "lib/socialShare/modules/creaseShift";
import type { SharePostCardProps } from "lib/socialShare/modules/contract";
import { PostEmpty, PostTeamMark } from "./kit";
import styles from "./CreaseShiftCard.module.scss";

const percent = (share: number | null) => share === null ? "—" : `${Math.round(share * 100)}%`;
/**
 * CHANGE in percentage points, its arrow in the row's own colour (TJ, 2026-11-11); a change that rounds to 0 has no arrow. The
 * share font has no triangles, so the fallback glyph is set smaller to sit with the digits.
 */
const change = (value: number | null): ReactNode => {
  if (value === null) return "—";
  const points = Math.round(value);
  return points ? <><span className={styles.arrow}>{points > 0 ? "▲" : "▼"}</span>{Math.abs(points)}</> : "0";
};
const crease = (team: CreaseShiftTeam) => team.startersUsed > 1 ? `Split, ${team.startersUsed} starters` : team.startersUsed === 1 ? "One starter" : "—";
/** Relief has no column, so a goalie with no start in either window has nothing to show here. */
const listed = (team: CreaseShiftTeam) => team.goalies.filter(goalie => goalie.starts > 0 || (goalie.comparisonStarts ?? 0) > 0);

/**
 * The table's width in the 1080 square, and its rows' height side by side: the 786px table, under the 32px subtitle and over
 * the note, less its 18px header. A stacked band has 8px over its names.
 */
const TABLE_WIDTH = 1008, ROWS_HEIGHT = 768, ROW_CHROME = 8, BAND_PADDING = 8;
/** Stacked rows share the 786px table under a 21px header, less a few pixels so the last chart never meets the note. */
const STACKED_HEIGHT = 758;
/**
 * Up to four teams, each row stacks: its names and numbers in larger type over a chart the table's full width, so the chart
 * grows both ways and the square has no empty band (TJ, 2026-11-11). More teams sit side by side, the chart filling each row.
 */
const STACKED = [
  { name: "rows-1", logo: 96, font: 34, stroke: 4, dot: 5, blockMax: 48 },
  { name: "rows-2", logo: 76, font: 30, stroke: 3.5, dot: 4, blockMax: 40 },
  { name: "rows-3", logo: 64, font: 27, stroke: 3, dot: 3.5, blockMax: 34 },
  { name: "rows-4", logo: 56, font: 25, stroke: 3, dot: 3.5, blockMax: 30 },
] as const;
type Size = { name: string; stacked: boolean; logo: number; chartWidth: number; chartHeight: number; stroke: number; dot: number; blockMax: number; band?: number };
/** `lines` is the most goalie lines in any row shown: the stacked band is as tall as that, and the chart takes the rest. */
const sizeFor = (rows: number, lines: number): Size => {
  if (rows <= STACKED.length) {
    // Every band is as tall as the tallest, so each chart gets the same height and no row keeps a gap over its chart.
    const size = STACKED[rows - 1], band = Math.max(size.logo, Math.ceil(lines * (size.font * 1.15 + 1))) + BAND_PADDING;
    return { ...size, stacked: true, band, chartWidth: TABLE_WIDTH, chartHeight: Math.floor(STACKED_HEIGHT / rows) - band - ROW_CHROME };
  }
  const chartHeight = Math.min(200, Math.floor(ROWS_HEIGHT / rows) - ROW_CHROME), base = { stacked: false, chartHeight, stroke: 2.5, dot: 3, blockMax: 30 };
  return rows <= 6 ? { ...base, name: "large", logo: 50, chartWidth: 410 } : rows <= 9 ? { ...base, name: "medium", logo: 40, chartWidth: 450 } : { ...base, name: "small", logo: 30, chartWidth: 480 };
};
const OTHER_STARTER = "#9aa3ad";
/** G1 and G2 in the team's colours, by most starts in the window; any other starter is neutral grey and dashed. */
function goalieColor(team: CreaseShiftTeam, goalie: CreaseShiftGoalie) {
  const index = team.goalies.filter(entry => entry.starts > 0).indexOf(goalie), colors = creaseColors(team.team);
  return index === 0 ? colors.g1 : index === 1 ? colors.g2 : index > 1 ? OTHER_STARTER : undefined;
}

const PAD = 5, SPAN_WIDTH = 36;
/** One block per game edge to edge, and each starter's running start share above it on a fixed 0 to 100% scale, so a point sits over its block. Colours are attributes: html-to-image drops class styles on SVG children. */
function CreaseChart({ team, width, height, size }: { team: CreaseShiftTeam; width: number; height: number; size: Size }) {
  const count = team.series.length, slot = width / Math.max(count, 1), blockHeight = Math.min(size.blockMax, Math.max(11, Math.round(height * 0.2))), blockTop = height - blockHeight;
  // A long window narrows the slots: the gap shrinks with them, and under 14px a slot has no dot, only the line.
  const gap = Math.min(3, slot / 5), dot = slot < 14 ? 0 : Math.min(size.dot, slot / 4), plotHeight = blockTop - 3;
  const x = (index: number) => (index + 0.5) * slot, y = (share: number) => plotHeight - PAD - share * (plotHeight - 2 * PAD);
  const starters = team.goalies.filter(goalie => goalie.starts > 0).reverse(), name = (id: number | null) => team.goalies.find(goalie => goalie.goalieId === id)?.name ?? id ?? "no resolved starter";
  return <svg className={styles.chart} width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${team.team}, starter by game, oldest to newest: ${team.series.map(point => name(point.starterId)).join(", ")}`}>
    {[1, 0.5, 0].map(share => <line key={share} x1={0} x2={width} y1={y(share)} y2={y(share)} stroke="#ffffff" strokeOpacity="0.14" strokeWidth="1" strokeDasharray={share === 0.5 ? "2 3" : undefined} />)}
    {starters.map(goalie => {
      const color = goalieColor(team, goalie)!, plotted = goalie.runningShare.flatMap((value, index) => value === null ? [] : [{ value, index }]);
      // The first and last games run on to the chart's edges, and a null value is a break in the line.
      const d = plotted.map(({ value, index }, order) => {
        const point = `${x(index).toFixed(1)} ${y(value).toFixed(1)}`;
        return `${index === 0 ? `M0 ${y(value).toFixed(1)}L${point}` : `${order && plotted[order - 1].index === index - 1 ? "L" : "M"}${point}`}${index === count - 1 ? `L${width} ${y(value).toFixed(1)}` : ""}`;
      }).join("");
      return <g key={goalie.goalieId} data-goalie={goalie.goalieId} data-values={goalie.runningShare.map(value => value ?? "gap").join(",")} data-color={color}>
        <path d={d} fill="none" stroke={color} strokeWidth={size.stroke} strokeLinejoin="round" strokeDasharray={color === OTHER_STARTER ? "4 3" : undefined} />
        {dot > 0 && plotted.map(({ value, index }) => <circle key={index} cx={x(index)} cy={y(value)} r={dot} fill={color} />)}
      </g>;
    })}
    {team.series.map((point, index) => {
      const starter = team.goalies.find(goalie => goalie.goalieId === point.starterId), color = starter && goalieColor(team, starter);
      // Only inner edges give up the gap, so the first and last blocks touch the chart's edges.
      const left = index * slot + (index ? gap / 2 : 0), right = (index + 1) * slot - (index < count - 1 ? gap / 2 : 0), box = { y: blockTop, height: blockHeight, rx: Math.min(2, (right - left) / 4) };
      return color ? <rect key={point.gameId} {...box} x={left} width={right - left} fill={color} data-block="started" data-starter={point.starterId ?? undefined} />
        : <rect key={point.gameId} y={blockTop + 0.5} height={blockHeight - 1} rx={box.rx} x={left + 0.5} width={Math.max(0, right - left - 1)} fill="none" stroke="#ffffff" strokeOpacity="0.45" strokeWidth="1" data-block="empty" />;
    })}
  </svg>;
}

export default function CreaseShiftCard({ data, logos }: SharePostCardProps<CreaseShiftSettings, CreaseShiftData>) {
  const shown = creaseShiftShown(data);
  if (!creaseShiftHasRows(data)) return <PostEmpty>{data.picked.length ? `No completed games in this window for ${data.picked.join(", ")}` : `No team has both windows resolved with ${data.minComparisonGames} comparison games`}</PostEmpty>;
  const size = sizeFor(shown.length, Math.max(1, ...shown.map(team => listed(team).length))), words = creaseShiftWords(data);
  // A team with nothing to list (no games in the window) still prints a dash in each column, as an unranked rank does.
  const lines = (team: CreaseShiftTeam, cell: (goalie: CreaseShiftGoalie) => ReactNode, colored = false) => <span className={styles.lines}>{listed(team).length ? listed(team).map(goalie => {
    const color = colored ? goalieColor(team, goalie) : undefined;
    return <span key={goalie.goalieId} style={color ? { color } : undefined} data-goalie-color={color}>{cell(goalie)}</span>;
  }) : <span>—</span>}</span>;
  // One span across every team shown goes in the header (PRIOR) or the subtitle (SEASON); otherwise each team prints its own, so a shared label can't mislead.
  const sharedSpan = words.span, heads = ["RK", "TEAM", "GOALIE", words.last, words.prior, "CHANGE", ...size.stacked ? [] : ["BY GAME"]];
  const chart = (team: CreaseShiftTeam) => <CreaseChart team={team} width={size.chartWidth - (sharedSpan === null && !size.stacked ? SPAN_WIDTH : 0)} height={size.chartHeight} size={size} />;
  const band = size.stacked || undefined;
  return <div className={styles.card} data-testid="crease-shift-card" data-size={size.name} data-stacked={band}>
    <p className={styles.subtitle} data-testid="crease-shift-subtitle">{words.subtitle}</p>
    <div className={styles.table} style={{ gridTemplateRows: `auto repeat(${shown.length}, ${size.stacked ? `minmax(${size.band}px, auto) minmax(min-content, 1fr)` : "minmax(min-content, 1fr)"})` }}>
      {heads.map((head, index) => <span key={head} className={styles.head} data-left={index === 1 || index === 2 || index === 6 || undefined}>{head}</span>)}
      {shown.map(team => <Fragment key={team.team}>
        <span className={styles.cell} data-band={band} data-testid="crease-shift-rank"><b>{team.rank ?? "—"}</b></span>
        <span className={styles.cell} data-band={band} data-left=""><span className={styles.team}><PostTeamMark team={team.team} logo={logos[team.team]} size={size.logo} /><span><b>{team.team}</b><small>{crease(team)}</small></span></span></span>
        <span className={styles.cell} data-band={band} data-left="">{lines(team, goalie => `${goalie.name ?? goalie.goalieId}${goalie.otherTeams.length ? ` (also ${goalie.otherTeams.join(", ")})` : ""}`, true)}</span>
        <span className={styles.cell} data-band={band}>{lines(team, goalie => percent(goalie.share), true)}</span>
        <span className={styles.cell} data-band={band}>{sharedSpan === null && <small className={styles.span} data-testid="crease-shift-span">{team.comparisonGames} GP</small>}{lines(team, goalie => percent(goalie.comparisonShare))}</span>
        <span className={styles.cell} data-band={band}>{lines(team, goalie => change(goalie.change))}</span>
        <span className={styles.cell} data-chart={band}>{chart(team)}</span>
      </Fragment>)}
    </div>
    <p className={styles.note} data-testid="crease-shift-note">Blocks show who started each game, oldest to newest. The line is the running share, ending at {words.last}. CHANGE is {words.last} minus {words.prior} in percentage points. Past starts only.</p>
  </div>;
}
