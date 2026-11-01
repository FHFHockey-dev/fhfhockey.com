/* eslint-disable @next/next/no-img-element -- Native data URLs are embedded by html-to-image for exact PNG exports. */
import type { ReactNode } from "react";
import styles from "./kit.module.scss";

/** Shared card parts for post modules: keep the post library one visual system without touching SocialShare.module.scss. */
export function PostTeamMark({ team, logo, size = 40 }: { team: string; logo: string | null | undefined; size?: number }) {
  return logo ? <img src={logo} alt="" width={size} height={size} /> : <b className={styles.teamFallback}>{team}</b>;
}
export type PostColumn<Row> = { id: string; label: string; numeric?: boolean; cell: (row: Row) => ReactNode };
export function PostTable<Row>({ columns, rows, rowKey }: { columns: readonly PostColumn<Row>[]; rows: readonly Row[]; rowKey: (row: Row) => string | number }) {
  return <div className={styles.table} style={{ gridTemplateColumns: columns.map(column => column.numeric ? "auto" : "minmax(0, 1fr)").join(" ") }}>
    {columns.map(column => <span key={column.id} className={styles.head} data-numeric={column.numeric || undefined}>{column.label}</span>)}
    {rows.map(row => columns.map(column => <span key={`${rowKey(row)}:${column.id}`} className={styles.cell} data-numeric={column.numeric || undefined}>{column.cell(row)}</span>))}
  </div>;
}
export const PostEmpty = ({ children }: { children: ReactNode }) => <p className={styles.empty}>{children}</p>;
