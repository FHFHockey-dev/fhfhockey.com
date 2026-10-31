import type { ReactNode } from "react";
import { heatLevel, moreTiedNote, type BoardSide } from "lib/socialShare/modules/shared/goalieBoards";
import { PostTeamMark } from "./kit";
import styles from "./GoalieBoards.module.scss";

const HEAT = { better: "0, 255, 153", worse: "255, 99, 132" };
/** Large value in a tile whose colour strength scales with its size. Dark text once the fill is bright enough to need it. */
export function HeatTile({ value, text, caption, largest }: { value: number | null; text: string; caption: string; largest: number }) {
  const { tone, alpha } = heatLevel(value, largest);
  const style = tone === "better" || tone === "worse" ? { background: `rgba(${HEAT[tone]}, ${alpha})`, color: alpha > 0.55 ? "#0b0f12" : "#ffffff" } : undefined;
  return <span className={styles.heat} data-testid="heat-tile" data-tone={tone} data-alpha={alpha} style={style}><b>{text}</b><small>{caption}</small></span>;
}
export function GoalieIdent({ rank, team, logo, name, detail }: { rank: number; team: string | undefined; logo: string | null | undefined; name: string; detail: ReactNode }) {
  return <>
    <span className={styles.rank}>{rank}</span>
    <span className={styles.logo}>{team && <PostTeamMark team={team} logo={logo} size={34} />}</span>
    <span className={styles.ident}><b>{name}</b><small>{detail}</small></span>
  </>;
}
const SIDE_TITLE = { best: "Best", worst: "Worst" };
/** Rows share the height left in the body, so the boards fill it however many goalies qualify; a small pool stops short of oversized rows. */
const FILL_FROM_ROWS = 4;
export function GoalieBoards<Row>({ sides, rowKey, renderRow, headNote, note }: { sides: readonly BoardSide<Row>[]; rowKey: (row: Row) => number; renderRow: (row: Row, rank: number) => ReactNode; headNote?: string; note?: string }) {
  const tied = moreTiedNote(sides), line = [tied, note].filter(Boolean).join(" ");
  return <>
    <div className={styles.boards} data-sides={sides.length}>
      {sides.map(side => {
        const rows = side.entries.length, track = rows >= FILL_FROM_ROWS ? "minmax(min-content, 1fr)" : "minmax(min-content, 130px)";
        return <section key={side.kind} className={styles.side} data-board={side.kind} data-testid={`board-${side.kind}`} style={{ gridTemplateRows: `auto repeat(${rows}, ${track})` }}>
          <h4 className={styles.sideHead} data-kind={side.kind}><span>{SIDE_TITLE[side.kind]}</span>{headNote && <small>{headNote}</small>}</h4>
          {side.entries.map(({ row, rank }) => <div key={rowKey(row)} className={styles.row}>{renderRow(row, rank)}</div>)}
        </section>;
      })}
    </div>
    {line && <p className={styles.more}>{line}</p>}
  </>;
}
