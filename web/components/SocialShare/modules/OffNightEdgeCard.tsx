import { Fragment, type ReactNode } from "react";
import type { SharePostCardProps } from "lib/socialShare/modules/contract";
import type { OffNightData, OffNightGroup, OffNightRow, OffNightSettings } from "lib/socialShare/modules/offNightEdge";
import { ownershipLabel } from "lib/socialShare/modules/shared/definitions";
import { PostEmpty, PostTeamMark } from "./kit";
import styles from "./OffNightEdgeCard.module.scss";

/** At or below this many rows (late in a week) the rows are tall enough for larger type. */
const ROOMY_ROWS = 10;

function PickCell({ row, group }: { row: OffNightRow; group: OffNightGroup }) {
  const pick = row.picks[group];
  if (!pick) return <span className={styles.gap} data-testid="off-night-gap">{row.gaps[group]}</span>;
  return <span className={styles.pick}><b>{pick.name}</b><small>{ownershipLabel(pick.ownership)} · {pick.fantasyPerGame.toFixed(1)} FP/G</small></span>;
}

const Head = ({ numeric, off, children }: { numeric?: boolean; off?: boolean; children: ReactNode }) => <span className={styles.head} data-numeric={numeric || undefined} data-off={off || undefined}>{children}</span>;
const Cell = ({ numeric, off, children }: { numeric?: boolean; off?: boolean; children: ReactNode }) => <span className={styles.cell} data-numeric={numeric || undefined} data-off={off || undefined}>{children}</span>;

export default function OffNightEdgeCard({ data, settings, logos }: Pick<SharePostCardProps<OffNightSettings, OffNightData>, "data" | "settings" | "logos">) {
  if (!data.rows.length) return <PostEmpty>No team has a game left in these dates</PostEmpty>;
  const roomy = data.rows.length <= ROOMY_ROWS;
  // Hand-built rather than PostTable: the rows share the body's height, and off-night tint runs the full column.
  return <div className={styles.body} data-dates={data.dates}>
    <div className={styles.table} data-roomy={roomy || undefined} style={{ gridTemplateColumns: `repeat(${5 + data.days.length}, auto) minmax(0, 1fr) minmax(0, 1fr)`, gridTemplateRows: `auto repeat(${data.rows.length}, 1fr)` }}>
      <Head numeric>RK</Head><Head>TEAM</Head><Head numeric>SCORE</Head><Head numeric>GP</Head><Head numeric>OFF</Head>
      {data.days.map(day => <Head key={day.date} numeric off={day.offNight}><span className={styles.dayHead}>{day.label.slice(0, 2).toUpperCase()}<small>{day.leagueGames}</small></span></Head>)}
      <Head>FORWARD</Head><Head>DEFENSE</Head>
      {data.rows.map(row => <Fragment key={row.team}>
        <Cell numeric>{row.rank}</Cell>
        <Cell><span className={styles.team}><PostTeamMark team={row.team} logo={logos[row.team]} size={roomy ? 56 : 38} />{row.team}</span></Cell>
        <Cell numeric><b className={styles.score}>{row.score.toFixed(1)}</b></Cell>
        <Cell numeric>{row.games}</Cell>
        <Cell numeric>{row.offNightGames}</Cell>
        {data.days.map((day, index) => <Cell key={day.date} numeric off={day.offNight}>{row.gamesByDay[index] || "·"}</Cell>)}
        <Cell><PickCell row={row} group="F" /></Cell>
        <Cell><PickCell row={row} group="D" /></Cell>
      </Fragment>)}
    </div>
    <p className={styles.legend} data-testid="off-night-legend">
      {data.dates === "weekly" ? "Full week, played games included" : "Rest of week"} · Shaded: 8 or fewer NHL games (count under each day) · Picks at or under {settings.ownershipCeiling}% rostered{settings.includeUnknown === "on" ? " · — unknown %" : ""}
    </p>
  </div>;
}
