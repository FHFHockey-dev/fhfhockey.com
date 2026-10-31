import type { SharePostCardProps } from "lib/socialShare/modules/contract";
import { formatMetricValue, windowLabel, type MetricChange, type MetricWindow, type WhatChangedData, type WhatChangedRow, type WhatChangedSettings } from "lib/socialShare/modules/whatChanged";
import { PostEmpty, PostTable, PostTeamMark, type PostColumn } from "./kit";
import styles from "./WhatChangedCard.module.scss";

const coverageText = (window: MetricWindow) => `${window.coverage.observed}/${window.coverage.expected}`;
/** Unresolved dates count inside the gap and are named, since they are not simply absent from the source. */
const coverageNote = (window: MetricWindow) => window.coverage.unresolved ? ` (${window.coverage.unresolved} unresolved)` : "";

export default function WhatChangedCard({ data, logos }: SharePostCardProps<WhatChangedSettings, WhatChangedData>) {
  const recentLabel = windowLabel(data.window), baselineLabel = data.comparison === "std" ? "STD" : `PREV ${data.requested}`;
  const sampleNote = data.comparison === "std" ? "OV = recent games also inside STD" : "No game is in both windows";
  const heading = `${recentLabel} versus ${data.comparison === "std" ? "season to date" : `previous ${data.requested}`}`;
  if (data.playerQuery.trim() && !data.focus) return <PostEmpty>{data.candidates.length ? `More than one player matches: ${data.candidates.map(candidate => `${candidate.name ?? "Unnamed"} ${candidate.team ?? ""} (${candidate.playerId})`).join(", ")}` : `No skater this season matches "${data.playerQuery}"`}</PostEmpty>;

  if (data.focus) {
    const focus = data.focus;
    const columns: PostColumn<MetricChange>[] = [
      { id: "metric", label: "METRIC", cell: row => <span>{row.label} <small className={styles.unit}>{row.unit}{row.strength.startsWith("All") ? "" : ", PP"}</small></span> },
      { id: "recent", label: recentLabel, numeric: true, cell: row => formatMetricValue(row, row.recent.value) },
      { id: "base", label: baselineLabel, numeric: true, cell: row => formatMetricValue(row, row.baseline.value) },
      { id: "delta", label: "CHANGE", numeric: true, cell: row => formatMetricValue(row, row.delta, true) },
      { id: "coverage", label: "COVERED", numeric: true, cell: row => `${coverageText(row.recent)} · ${coverageText(row.baseline)}` },
    ];
    return <div className={styles.card}>
      <p className={styles.heading}><PostTeamMark team={focus.team ?? "—"} logo={focus.team ? logos[focus.team] : null} size={32} /> {focus.name ?? `Player ${focus.playerId}`} · {heading}</p>
      <PostTable columns={columns} rows={focus.changes} rowKey={row => row.metric} />
      <p className={styles.note}>{focus.recentGames} recent GP, {focus.baselineGames} {baselineLabel} GP, {focus.overlap} overlap.{focus.short ? " Short sample." : ""}{focus.eligible ? "" : " Below the minimum season GP."}{focus.teamChange ? ` Moved ${focus.teamChange.from} to ${focus.teamChange.to}.` : ""} {sampleNote}. — means below coverage or no denominator.</p>
    </div>;
  }

  const usesCoverage = [...data.risers, ...data.fallers].some(row => row.change.group === "Underlying");
  const columns: PostColumn<WhatChangedRow>[] = [
    { id: "rank", label: "RK", numeric: true, cell: row => row.rank },
    { id: "player", label: "PLAYER", cell: row => <span className={styles.player}><PostTeamMark team={row.team ?? "—"} logo={row.team ? logos[row.team] : null} size={26} />{row.name ?? `Player ${row.playerId}`}{row.teamChange ? " †" : ""}</span> },
    { id: "recent", label: recentLabel, numeric: true, cell: row => formatMetricValue(row.change, row.change.recent.value) },
    { id: "base", label: baselineLabel, numeric: true, cell: row => formatMetricValue(row.change, row.change.baseline.value) },
    { id: "delta", label: "CHANGE", numeric: true, cell: row => formatMetricValue(row.change, row.change.delta, true) },
    { id: "gp", label: "GP", numeric: true, cell: row => `${row.recentGames}/${row.baselineGames}` },
    ...(data.comparison === "std" ? [{ id: "overlap", label: "OV", numeric: true, cell: (row: WhatChangedRow) => row.overlap }] : []),
    ...(usesCoverage ? [{ id: "coverage", label: "COVERED", numeric: true, cell: (row: WhatChangedRow) => `${coverageText(row.change.recent)} · ${coverageText(row.change.baseline)}${coverageNote(row.change.recent)}` }] : []),
  ];
  if (!data.risers.length && !data.fallers.length) return <PostEmpty>No player qualifies: {data.cohort.eligible} eligible, {data.cohort.shortSample} short sample, {data.cohort.unadmitted} below coverage</PostEmpty>;
  const { cohort } = data, moved = [...data.risers, ...data.fallers].some(row => row.teamChange);
  return <div className={styles.card}>
    <p className={styles.heading}>{data.metricLabel} {data.unit} · {heading}</p>
    <section className={styles.list}><h3>UP</h3>{data.risers.length ? <PostTable columns={columns} rows={data.risers} rowKey={row => row.playerId} /> : <p className={styles.note}>No riser qualifies</p>}</section>
    <section className={styles.list}><h3>DOWN</h3>{data.fallers.length ? <PostTable columns={columns} rows={data.fallers} rowKey={row => row.playerId} /> : <p className={styles.note}>No faller qualifies</p>}</section>
    <p className={styles.note}>{cohort.ranked} ranked of {cohort.eligible} eligible; {cohort.shortSample} short sample and {cohort.unadmitted} below coverage are unranked{cohort.unlisted ? `; ${cohort.unlisted} more not listed` : ""}. GP = recent/{baselineLabel}. {sampleNote}.{moved ? " † changed teams in this sample." : ""}</p>
  </div>;
}
