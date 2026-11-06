import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import type { ProjectedUnitSet, ProjectionReport } from "lib/sources/projectedLineups";
import styles from "./ProjectedLineups.module.scss";
import GameLineSnapshots, { mergeFrozenEntries } from "./GameLineSnapshots";
import { formatTime } from "./reviewReasonCopy";
import type { GameLinesResponse } from "lib/lines/types";

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
        <p className={styles.itemTitle}>{set.reports[0]!.teamAbbreviation} · {set.situation === "es" ? "Even strength" : set.situation.toUpperCase()}{set.group ? ` · Group ${set.group.toUpperCase()}` : ""}</p>
        <p className={styles.muted}>{set.reports[0]!.interpretation.context} · {set.reports[0]!.interpretation.certainty} · <time dateTime={set.publishedAt}>{formatTime(set.publishedAt)}</time></p>
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
      {reports.map((report) => <article className={styles.card} key={report.key}>
        <p className={styles.itemTitle}>{report.teamAbbreviation} · {report.interpretation.context}</p>
        {report.publishedAt && <time className={styles.muted} dateTime={report.publishedAt}>{formatTime(report.publishedAt)}</time>}
        {report.originalUrl ? <blockquote className="twitter-tweet" data-theme="dark" data-conversation="none"><p className={styles.rawText}>{report.text}</p><a href={report.originalUrl}>View original post</a></blockquote> : <><p className={styles.rawText}>{report.text}</p><p className={styles.muted}>Original source link pending</p></>}
      </article>)}
      {reports.some((report) => report.originalUrl) && <Script id="projected-tweet-embeds" src="https://platform.twitter.com/widgets.js" strategy="lazyOnload" onReady={loadEmbeds} />}
    </aside>
  </section>;
}

export default function ProjectedLineups({ teamId, gameId, onGameChange }: { teamId?: number; gameId?: number; onGameChange?: (id: number) => void }) {
  const [data, setData] = useState<ProjectionResponse | GameLinesResponse | null>(null);
  const [selectedGameId, setSelectedGameId] = useState<number | undefined>(gameId);
  const [failed, setFailed] = useState(false);
  const [loadedAt, setLoadedAt] = useState<string | null>(null);
  useEffect(() => setSelectedGameId(gameId), [gameId, teamId]);
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (teamId) params.set("teamId", String(teamId));
    if (selectedGameId) params.set("gameId", String(selectedGameId));
    setData(null); setFailed(false); setLoadedAt(null);
    let refresh: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      try {
        const response = await fetch(`/api/v1/lines/projected?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error("unavailable");
        const result = await response.json();
        if (!controller.signal.aborted) {
          setData((previous) => result.mode === "snapshots" ? mergeFrozenEntries(previous && "mode" in previous ? previous : null, result) : result);
          setFailed(false); setLoadedAt(new Date().toISOString());
        }
      } catch { if (!controller.signal.aborted) setFailed(true); }
      finally { if (!controller.signal.aborted) refresh = setTimeout(load, 60_000); }
    };
    void load();
    return () => { controller.abort(); clearTimeout(refresh); };
  }, [teamId, selectedGameId]);
  if (!data) return failed
    ? <p role="status" className={styles.stateError}>Lineups are unavailable right now. We&apos;ll try again in a minute.</p>
    : <p role="status" aria-busy="true" className={styles.stateLoading}>Loading game lineups…</p>;
  // Publishing switched off is an internal state: render nothing rather than flag wording (style audit High 2).
  if (!data.enabled || ("mode" in data && data.status === "disabled")) return null;
  return <>{failed && <p role="status" className={styles.stateWarn}>Couldn&apos;t refresh. Showing lineups as of {loadedAt ? <time dateTime={loadedAt}>{formatTime(loadedAt)}</time> : "the last update"}.</p>}
    {"mode" in data ? <GameLineSnapshots data={data} onGameChange={(id) => { setSelectedGameId(id); onGameChange?.(id); }} /> : <ProjectedLineupsContent data={data} />}</>;
}
