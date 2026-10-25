import styles from "./LoadingCells.module.scss";

export function LoadingCell({ shape = "number" }: { shape?: "number" | "team" | "trend" }) {
  return <span className={styles.cell} data-shape={shape} data-loading-placeholder aria-hidden="true" />;
}

/** Anonymous slots reserve the season's team footprint without inventing teams or totals. */
export function LoadingRows({ columns, teamColumn = 0, waiting = true, rowHeight = 49, rows = 33 }: {
  columns: number; teamColumn?: number; waiting?: boolean; rowHeight?: number; rows?: number;
}) {
  return <>{Array.from({ length: rows }, (_, row) => <tr key={row} data-placeholder-row={row === 0 ? "totals" : "team"}
    aria-hidden="true" style={{ height: row === 0 ? 30 : rowHeight }}>
    {Array.from({ length: columns }, (_, column) => <td key={column} className={styles.placeholderCell}>
      {waiting ? <LoadingCell shape={row > 0 && column === teamColumn ? "team" : "number"} /> : "—"}
    </td>)}
  </tr>)}</>;
}
