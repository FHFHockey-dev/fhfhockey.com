import type { SharePostCardProps } from "lib/socialShare/modules/contract";
import type { ReactNode } from "react";
import { formatMetricValue, seriesRuns, windowLabel, type MetricChange, type MetricWindow, type SeriesPoint, type WhatChangedData, type WhatChangedRow, type WhatChangedSettings } from "lib/socialShare/modules/whatChanged";
import { HeatTile } from "./GoalieBoards";
import { PostEmpty, PostTable, PostTeamMark, type PostColumn } from "./kit";
import styles from "./WhatChangedCard.module.scss";

const coverageText = (window: MetricWindow) => `${window.coverage.observed}/${window.coverage.expected}`;
/** Unresolved dates count inside the gap and are named, since they are not simply absent from the source. */
const coverageNote = (window: MetricWindow) => window.coverage.unresolved ? ` (${window.coverage.unresolved} unresolved)` : "";
const belowCoverage = (tile: MetricChange) => !tile.recent.admitted ? coverageText(tile.recent) : !tile.baseline.admitted ? coverageText(tile.baseline) : null;

const SPARK_WIDTH = 280, SPARK_HEIGHT = 84, PLOT_LEFT = 38, PLOT_RIGHT = 274, PLOT_TOP = 5, PLOT_BOTTOM = 68, LINE = "#ffffff";
const shortDate = (date: string) => date.slice(5).replace("-", "/");
/** Game-by-game line of the ranked metric on a value and date axis: a missing game breaks the line and leaves a tick, and a band marks the recent window. Colours are attributes because the PNG capture drops stylesheet fills. */
export function RecentSpark({ series, recentFrom, recentLabel, format }: { series: readonly SeriesPoint[]; recentFrom: number; recentLabel: string; format: (value: number) => string }) {
  const values = series.map(point => point.value), known = values.filter((value): value is number => value !== null);
  const low = Math.min(...known), high = Math.max(...known), step = (PLOT_RIGHT - PLOT_LEFT) / Math.max(1, values.length - 1);
  const x = (index: number) => PLOT_LEFT + index * step;
  const y = (value: number) => high === low ? (PLOT_TOP + PLOT_BOTTOM) / 2 : PLOT_BOTTOM - (value - low) / (high - low) * (PLOT_BOTTOM - PLOT_TOP);
  const start = recentFrom === 0 ? PLOT_LEFT : x(recentFrom) - step / 2, marks = !known.length ? [] : high === low ? [high] : [high, low];
  const axisText = { fontSize: "12", fill: LINE, fillOpacity: "0.75" };
  return <svg className={styles.spark} width={SPARK_WIDTH} height={SPARK_HEIGHT} viewBox={`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`} aria-hidden="true" data-sparkline={values.map(value => value ?? "gap").join(",")} data-recent-from={recentFrom}>
    <rect x={start.toFixed(1)} y="0" width={(SPARK_WIDTH - start).toFixed(1)} height={PLOT_BOTTOM + 3} fill={LINE} fillOpacity="0.09" />
    {recentFrom > 0 && <path d={`M${start.toFixed(1)} 0V${PLOT_BOTTOM + 3}`} stroke={LINE} strokeOpacity="0.55" strokeWidth="1" strokeDasharray="3 3" />}
    {marks.map(mark => <g key={mark}>
      <path d={`M${PLOT_LEFT} ${y(mark).toFixed(1)}H${PLOT_RIGHT}`} stroke={LINE} strokeOpacity="0.22" strokeWidth="1" />
      <text x={PLOT_LEFT - 4} y={(y(mark) + 4).toFixed(1)} textAnchor="end" data-axis="value" {...axisText}>{format(mark)}</text>
    </g>)}
    {series.map((point, index) => <path key={point.gameId} d={`M${x(index).toFixed(1)} ${PLOT_BOTTOM + 3}v-3`} stroke={LINE} strokeOpacity="0.5" strokeWidth="1" />)}
    {seriesRuns(values).filter(run => run.length > 1).map(run => <path key={run[0]} d={run.map((index, at) => `${at ? "L" : "M"}${x(index).toFixed(1)} ${y(values[index]!).toFixed(1)}`).join("")} fill="none" stroke={LINE} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />)}
    {series.map((point, index) => point.value === null
      ? <path key={point.gameId} d={`M${x(index).toFixed(1)} ${PLOT_BOTTOM}v-12`} stroke={LINE} strokeOpacity="0.7" strokeWidth="1.5" strokeDasharray="3 2" data-gap="" />
      : <circle key={point.gameId} cx={x(index).toFixed(1)} cy={y(point.value).toFixed(1)} r="3.5" fill={LINE} />)}
    {series.length > 0 && <text x={PLOT_LEFT} y="82" textAnchor="start" data-axis="date" {...axisText}>{shortDate(series[0].date)}</text>}
    {series.length > 1 && <text x={PLOT_RIGHT} y="82" textAnchor="end" data-axis="date" {...axisText}>{shortDate(series[series.length - 1].date)}</text>}
    <text x={recentFrom === 0 ? (PLOT_LEFT + PLOT_RIGHT) / 2 : start + 3} y="82" textAnchor={recentFrom === 0 ? "middle" : "start"} fontSize="12" fontWeight="700" fill={LINE}>{recentLabel}</text>
  </svg>;
}

function GroupTile({ tile }: { tile: MetricChange }) {
  const mark = belowCoverage(tile), direction = tile.delta === null ? "none" : tile.delta > 0 ? "up" : tile.delta < 0 ? "down" : "flat";
  return <span className={styles.tile} data-testid="group-tile" data-metric={tile.metric} data-direction={direction}>
    <span className={styles.tileLabel}><small>{tile.group}</small><small>{tile.short}</small></span>
    <span className={styles.tileValue}><b>{formatMetricValue(tile, tile.recent.value)}</b><i data-covered={mark ? "below" : undefined}>{mark ?? formatMetricValue(tile, tile.delta, true)}</i></span>
  </span>;
}

/** Rows share the height left in the body; a small pool stops short of oversized rows. */
const FILL_FROM_ROWS = 4;
export function ChangeSide<Row>({ kind, rows, rowKey, empty, renderRow }: { kind: "up" | "down"; rows: readonly Row[]; rowKey: (row: Row) => number; empty: string; renderRow: (row: Row) => ReactNode }) {
  const track = rows.length >= FILL_FROM_ROWS ? "minmax(min-content, 1fr)" : "minmax(min-content, 130px)";
  return <section className={styles.side} data-testid={`board-${kind}`} style={{ gridTemplateRows: rows.length ? `auto repeat(${rows.length}, ${track})` : "auto 1fr" }}>
    <h4 className={styles.sideHead} data-kind={kind}>{kind === "up" ? "Up" : "Down"}</h4>
    {!rows.length && <p className={styles.note}>{empty}</p>}
    {rows.map(row => <div key={rowKey(row)} className={styles.row} data-testid="change-row">{renderRow(row)}</div>)}
  </section>;
}
function ChangeBoard({ kind, rows, comparison, recentLabel, largest, logos }: { kind: "up" | "down"; rows: readonly WhatChangedRow[]; comparison: WhatChangedData["comparison"]; recentLabel: string; largest: number; logos: SharePostCardProps<WhatChangedSettings, WhatChangedData>["logos"] }) {
  return <ChangeSide kind={kind} rows={rows} rowKey={row => row.playerId} empty={`No ${kind === "up" ? "riser" : "faller"} qualifies`} renderRow={row => <>
      <span className={styles.rank}>{row.rank}</span>
      <span className={styles.logo}>{row.team && <PostTeamMark team={row.team} logo={logos[row.team]} size={34} />}</span>
      <span className={styles.ident}>
        <b>{row.name ?? `Player ${row.playerId}`}{row.teamChange ? " †" : ""}</b>
        <small>{row.recentGames} {comparison === "std" ? "of" : "vs"} {row.baselineGames} GP{row.change.group === "Underlying" ? ` · NST ${coverageText(row.change.recent)} · ${coverageText(row.change.baseline)}${coverageNote(row.change.recent)}` : ""}</small>
      </span>
      <HeatTile value={row.change.delta} text={formatMetricValue(row.change, row.change.delta, true)} caption={row.change.short} largest={largest} />
      <div className={styles.strip}>
        <div className={styles.tiles}>{row.tiles.map(tile => <GroupTile key={tile.metric} tile={tile} />)}</div>
        <RecentSpark series={row.series} recentFrom={row.recentFrom} recentLabel={recentLabel} format={value => formatMetricValue(row.change, value)} />
      </div>
    </>} />;
}

export default function WhatChangedCard({ data, logos }: SharePostCardProps<WhatChangedSettings, WhatChangedData>) {
  const recentLabel = windowLabel(data.window), baselineLabel = data.comparison === "std" ? "STD" : `PREV ${data.requested}`;
  const sampleNote = data.comparison === "std" ? `${recentLabel} games are inside STD` : "No game in both";
  const heading = `${recentLabel} versus ${data.comparison === "std" ? "season to date" : `previous ${data.requested}`}`;
  if (data.playerQuery.trim() && !data.focus) return <PostEmpty>{data.candidates.length ? `More than one player matches: ${data.candidates.map(candidate => `${candidate.name ?? "Unnamed"} ${candidate.team ?? ""} (${candidate.playerId})`).join(", ")}` : `No skater this season matches "${data.playerQuery}"`}</PostEmpty>;

  if (data.focus) {
    const focus = data.focus;
    const columns: PostColumn<MetricChange>[] = [
      { id: "metric", label: "METRIC", cell: row => <span className={styles.metric}>{row.label}<small className={styles.unit}>{row.unit}{row.strength.startsWith("All") ? "" : ", PP"}</small></span> },
      { id: "recent", label: recentLabel, numeric: true, cell: row => formatMetricValue(row, row.recent.value) },
      { id: "base", label: baselineLabel, numeric: true, cell: row => formatMetricValue(row, row.baseline.value) },
      { id: "delta", label: "CHANGE", numeric: true, cell: row => formatMetricValue(row, row.delta, true) },
      { id: "coverage", label: "COVERED", numeric: true, cell: row => `${coverageText(row.recent)} · ${coverageText(row.baseline)}` },
    ];
    return <div className={styles.card}>
      <p className={styles.heading}><PostTeamMark team={focus.team ?? "—"} logo={focus.team ? logos[focus.team] : null} size={32} /> {focus.name ?? `Player ${focus.playerId}`} · {heading}</p>
      <section className={styles.list} data-focus><PostTable columns={columns} rows={focus.changes} rowKey={row => row.metric} /></section>
      <p className={styles.note}>GP {focus.recentGames}/{focus.baselineGames} · {sampleNote}{focus.short ? " · Short sample" : ""}{focus.eligible ? "" : " · Below min GP"}{focus.teamChange ? ` · Moved ${focus.teamChange.from} to ${focus.teamChange.to}` : ""}</p>
    </div>;
  }

  if (!data.risers.length && !data.fallers.length) return <PostEmpty>No player qualifies: {data.cohort.eligible} eligible, {data.cohort.shortSample} short sample, {data.cohort.unadmitted} below coverage</PostEmpty>;
  const rows = [...data.risers, ...data.fallers], largest = Math.max(...rows.map(row => Math.abs(row.change.delta ?? 0)));
  const tiedAt = (side: readonly WhatChangedRow[]) => side[side.length - 1]?.rank;
  const legend = [
    `Tiles: ${recentLabel}, change vs ${baselineLabel}`, sampleNote, "Line = last 10 games",
    ...(rows.some(row => row.tiles.some(belowCoverage)) ? ["n/m = below coverage"] : []),
    ...(rows.some(row => row.teamChange) ? ["† new team"] : []),
    ...(data.moreTied.up ? [`Up: ${data.moreTied.up} more tied at rank ${tiedAt(data.risers)}`] : []),
    ...(data.moreTied.down ? [`Down: ${data.moreTied.down} more tied at rank ${tiedAt(data.fallers)}`] : []),
  ].join(" · ");
  const board = { comparison: data.comparison, recentLabel, largest, logos };
  return <div className={styles.card}>
    <p className={styles.heading}>{data.metricLabel} {data.unit} · {heading}</p>
    <div className={styles.boards}>
      <ChangeBoard kind="up" rows={data.risers} {...board} />
      <ChangeBoard kind="down" rows={data.fallers} {...board} />
    </div>
    <p className={styles.note}>{legend}</p>
  </div>;
}
