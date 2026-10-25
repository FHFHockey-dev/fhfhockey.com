import type { NewsLineupPresentation, NewsLineupRow } from "lib/newsLineupPresentation";
import styles from "./NewsLineupGrid.module.scss";

export default function NewsLineupGrid({ lineup, mini = false, onGoalieSlotClick }: {
  lineup: NewsLineupPresentation;
  mini?: boolean;
  onGoalieSlotClick?: (slotIndex: number) => void;
}) {
  const goalieRows = lineup.rows.filter((row) => row.kind === "goalie");
  const goalieIndex = (row: NewsLineupRow, index: number) => /^G\d+$/.test(row.label)
    ? Number(row.label.slice(1)) - 1
    : goalieRows.slice(0, goalieRows.indexOf(row)).reduce((count, goalie) => count + goalie.players.length, 0) + index;
  const suppliedGoalieSlots = new Set(goalieRows.flatMap((row) => row.players.map((_, index) => goalieIndex(row, index))));
  const groups: Array<{ kind: NewsLineupRow["kind"]; title: string }> = [
    { kind: "forward", title: "Forwards" }, { kind: "defense", title: "Defense" },
    { kind: "goalie", title: "Goalies" }, { kind: "pp", title: "Power play" },
    { kind: "pk", title: "Penalty kill" }, { kind: "scratch", title: "Scratches" },
    { kind: "injury", title: "Injured" },
  ];
  return (
    <div className={`${styles.preview} ${mini ? styles.mini : ""}`}>
      <p className={styles.context}>{lineup.context}{mini && lineup.rows.length ? " · Scroll if needed" : ""}</p>
      {lineup.notice ? <p className={styles.notice}>{lineup.notice}</p> : null}
      {lineup.rows.length ? (
        <div className={styles.viewport} role="region" aria-label={`${lineup.context} players`} tabIndex={0}>
          <div className={styles.grid}>
            {groups.map(({ kind, title }) => {
              const rows = lineup.rows.filter((row) => row.kind === kind);
              if (!rows.length) return null;
              return (
                <div key={kind} className={styles.group} data-role={kind} role="group" aria-label={title}>
                  {!mini ? <h3>{title}</h3> : null}
                  {rows.map((row, rowIndex) => (
                    <div key={rowIndex} className={styles.unit} role="group"
                      aria-label={`${row.group ? `Group ${row.group} · ` : ""}${row.label}${row.partial ? " · partial" : ""}`}>
                      {!mini && row.group ? <span className={styles.groupLabel}>Group {row.group}</span> : null}
                      <div className={styles.players} data-role={kind}>
                        {row.players.map((name, index) => {
                          const starter = kind === "goalie" && Boolean(name && lineup.startingGoalie &&
                            name.toLowerCase() === lineup.startingGoalie.toLowerCase());
                          const content = <>{!mini ? <span className={styles.role}>{row.label}{starter ? " · Starter" : ""}</span> : null}
                            <span className={styles.name} title={mini ? name || "Not supplied" : undefined}>{name || "Not supplied"}</span></>;
                          return kind === "goalie" && onGoalieSlotClick ? (
                            <button key={index} type="button" className={styles.slot}
                              aria-label={`Set G${goalieIndex(row, index) + 1} goalie`} onClick={() => onGoalieSlotClick(goalieIndex(row, index))}>{content}</button>
                          ) : <div key={index} className={styles.slot} data-missing={!name || undefined}
                            role={mini ? "group" : undefined}
                            aria-label={mini ? `${row.label}${starter ? " · Starter" : ""}: ${name || "Not supplied"}` : undefined}>{content}</div>;
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
      {onGoalieSlotClick ? <div className={styles.goalieActions}>
        {[0, 1].filter((index) => !suppliedGoalieSlots.has(index)).map((index) =>
          <button key={index} type="button" onClick={() => onGoalieSlotClick(index)}>Set G{index + 1} goalie</button>)}
      </div> : null}
    </div>
  );
}
