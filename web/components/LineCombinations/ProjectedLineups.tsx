import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import type { ProjectedUnitSet, ProjectionReport } from "lib/sources/projectedLineups";
import styles from "./ProjectedLineups.module.scss";

type ProjectionResponse = { enabled: boolean; sets: ProjectedUnitSet[]; reports: ProjectionReport[] };

export function ProjectedLineupsContent({ data }: { data: ProjectionResponse }) {
  const rail = useRef<HTMLElement>(null);
  const loadEmbeds = () => {
    const twitter = (window as unknown as { twttr?: { widgets?: { load: (element: HTMLElement) => void } } }).twttr;
    if (rail.current) twitter?.widgets?.load(rail.current);
  };
  useEffect(loadEmbeds, [data]);
  if (!data.enabled) return null;
  const reports = [...data.reports].sort((a, b) => Date.parse(b.publishedAt ?? b.receivedAt) - Date.parse(a.publishedAt ?? a.receivedAt));
  return <section className={styles.layout} aria-label="Projected line combinations">
    <div>
      <h2>Projected line combinations</h2>
      <p className={styles.muted}>Latest validated reports. Times and practice context are shown for each update.</p>
      {!data.sets.length && <p>No complete projected units have been reported for this occasion. Partial reports appear in the rail.</p>}
      {data.sets.map((set) => <article className={styles.card} key={set.key}>
        <h3>{set.reports[0]!.teamAbbreviation} · {set.situation === "es" ? "Even strength" : set.situation.toUpperCase()}{set.group ? ` · Group ${set.group.toUpperCase()}` : ""}</h3>
        <p className={styles.muted}>{set.reports[0]!.interpretation.context} · {set.reports[0]!.interpretation.certainty} · <time dateTime={set.publishedAt}>{new Date(set.publishedAt).toLocaleString()}</time></p>
        <ul className={styles.units}>{set.units.map((unit, index) => <li key={`${unit.situation}:${unit.number}:${index}`}>
          <span>{unit.situation === "es_defense" ? "Pair" : unit.situation === "es_forward" ? "Line" : unit.situation.toUpperCase()} {unit.number}</span>
          <strong>{unit.players.map((player) => player.name).join(" — ")}</strong>
        </li>)}</ul>
        {set.reports.map((report) => report.originalUrl ? <a className={styles.source} key={report.key} href={report.originalUrl} target="_blank" rel="noreferrer">Original report</a> : <span className={styles.muted} key={report.key}>Original source link pending</span>)}
      </article>)}
    </div>
    <aside ref={rail} className={styles.rail} aria-label="Latest team reports">
      <h2>Latest reports</h2>
      {reports.length === 0 && <p>No reports yet.</p>}
      {reports.slice(0, 8).map((report) => <article className={styles.card} key={report.key}>
        <h3>{report.teamAbbreviation} · {report.interpretation.context}</h3>
        {report.publishedAt && <time className={styles.muted} dateTime={report.publishedAt}>{new Date(report.publishedAt).toLocaleString()}</time>}
        {report.originalUrl ? <blockquote className="twitter-tweet" data-theme="dark" data-conversation="none"><p className={styles.text}>{report.text}</p><a href={report.originalUrl}>View original tweet</a></blockquote> : <><p className={styles.text}>{report.text}</p><p className={styles.muted}>Original source link pending</p></>}
      </article>)}
      {reports.some((report) => report.originalUrl) && <Script id="projected-tweet-embeds" src="https://platform.twitter.com/widgets.js" strategy="lazyOnload" onReady={loadEmbeds} />}
    </aside>
  </section>;
}

export default function ProjectedLineups({ teamId, gameId }: { teamId?: number; gameId?: number }) {
  const [data, setData] = useState<ProjectionResponse | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (teamId) params.set("teamId", String(teamId));
    if (gameId) params.set("gameId", String(gameId));
    setData(null); setFailed(false);
    let refresh: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      try {
        const response = await fetch(`/api/v1/lines/projected?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error("unavailable");
        const result = await response.json();
        if (!controller.signal.aborted) { setData(result); setFailed(false); }
      } catch { if (!controller.signal.aborted) setFailed(true); }
      finally { if (!controller.signal.aborted) refresh = setTimeout(load, 60_000); }
    };
    void load();
    return () => { controller.abort(); clearTimeout(refresh); };
  }, [teamId, gameId]);
  if (failed) return <p role="status">Projected lineups are temporarily unavailable.</p>;
  return data ? <ProjectedLineupsContent data={data} /> : null;
}
