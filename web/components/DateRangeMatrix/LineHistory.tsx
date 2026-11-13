import { useEffect, useRef, useState } from "react";
import type { LineHistoryItem, LineHistoryPage } from "lib/sources/lineHistory";
import styles from "./LineHistory.module.scss";
import type { ObservedDeploymentUnit } from "lib/drm/observedDeployment";
import { sharedClock } from "./ObservedUnits";
import { SHOW_DIAGNOSTICS } from "./diagnostics";
import { formatScopeDate } from "./formatScopeDate";

type Comparison = { observedUnits?: ObservedDeploymentUnit[]; qualifiedGameIds?: number[] };
type Props = Comparison & { teamId: number; teamName: string; startDate: string; endDate: string };
const situations: Record<string, string> = {
  es_forward: "ES forwards", es_defense: "ES defense", pp: "Power play",
  pk: "Penalty kill", goalie: "Goalies", scratch: "Scratches", injury: "Injuries",
};
const clock = (value: string) => new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short",
}).format(new Date(value));

function comparison(item: LineHistoryItem, report: LineHistoryItem["units"][number], evidence: Comparison) {
  if (item.gameLink !== "verified" || item.gameId == null || !report.complete) return null;
  const kinds: Record<string, ObservedDeploymentUnit["kind"]> = { es_forward: "forward_line", es_defense: "defense_pair", pp: "power_play", pk: "penalty_kill" };
  const kind = kinds[report.situation];
  if (!kind) return null;
  if (!evidence.qualifiedGameIds?.includes(item.gameId)) return "On-ice comparison isn’t available for this game yet.";
  const ids = report.players.map(player => player.playerId).sort((a, b) => a - b).join(":");
  const seconds = (evidence.observedUnits ?? []).filter(unit => unit.kind === kind && unit.gameIds.includes(item.gameId!) &&
    [...unit.playerIds].sort((a, b) => a - b).join(":") === ids).reduce((sum, unit) => sum + unit.seconds, 0);
  const strength = report.situation.startsWith("es_") ? "at 5-on-5" : "at this strength";
  return seconds > 0 ? `Observed together for ${sharedClock(seconds)} ${strength} in this game.`
    : `This exact unit didn’t play together ${strength} in this game’s shift data.`;
}

function Report({ item, ...evidence }: { item: LineHistoryItem } & Comparison) {
  return <article className={styles.report}>
    {item.gameLink === "verified" && item.gameDate && <p>Game date: <time dateTime={item.gameDate}>{item.gameDate}</time>.</p>}
    {item.gameLink !== "verified" && <p>Not matched to a game.</p>}
    <p>
      {item.originalPublishedAt
        ? <>Published <time dateTime={item.originalPublishedAt}>{clock(item.originalPublishedAt)} ET</time></>
        : <>Filed under <time dateTime={item.reportDate}>{item.reportDate}</time>; first posting time unknown.</>}
      {" · "}{item.context}
    </p>
    {item.sourceUrl
      ? <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">View original report</a>
      : <p>Original link unavailable.</p>}
    <p className={styles.text}>{item.text}</p>
    {item.units.length > 0 && <ul>
      {item.units.map((unit, index) => <li key={index}>
        {situations[unit.situation] ?? unit.situation}{unit.number != null ? ` ${unit.number}` : ""}: {unit.players.map(player => player.name).join(" / ")}
        {!unit.complete && " (partial report)"}
        {comparison(item, unit, evidence) && <p>{comparison(item, unit, evidence)}</p>}
      </li>)}
    </ul>}
    {SHOW_DIAGNOSTICS && <details>
      <summary>Retained interpretation</summary>
      <p>Version {item.version}. {item.interpretedAt ? `Interpreted ${clock(item.interpretedAt)} ET.` : "Interpretation time unknown."}</p>
      <p>{item.recordType === "legacy_report" ? "Legacy report interpretation" : `Recorded claim: ${item.recordType.replaceAll("_", " ")}`}. This report is not evidence of shared ice time.</p>
    </details>}
  </article>;
}

function HistoryList({ teamId, startDate, endDate, mode, observedUnits, qualifiedGameIds }: Props & { mode: "game" | "publication" | "claimPublication" }) {
  const [items, setItems] = useState<LineHistoryItem[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error" | "disabled">("idle");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [skipped, setSkipped] = useState(0);
  const [scanned, setScanned] = useState(0);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  async function load() {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setStatus("loading");
    try {
      const query = new URLSearchParams({ teamId: String(teamId), startDate, endDate, mode });
      if (nextCursor) query.set("cursor", nextCursor);
      const response = await fetch(`/api/v1/lines/history?${query}`, { signal: controller.signal });
      if (!response.ok) throw new Error("History unavailable");
      const data: LineHistoryPage = await response.json();
      if (controller.signal.aborted) return;
      if (typeof data?.enabled !== "boolean" || !Array.isArray(data.items)) throw new Error("Invalid history response");
      if (!data.enabled) {
        setItems([]); setNextCursor(null); setStatus("disabled"); return;
      }
      setItems(previous => [...new Map([...previous, ...data.items].map(item => [item.id, item])).values()]);
      setNextCursor(data.nextCursor);
      setSkipped(previous => previous + data.skippedRecords);
      setScanned(previous => previous + data.scannedRecords);
      setStatus("success");
    } catch {
      if (!controller.signal.aborted) setStatus("error");
    }
  }

  const dated = items.filter(item => item.originalPublishedAt != null);
  const unknown = items.filter(item => item.originalPublishedAt == null);
  const label = mode === "game" ? "Game-day lineups" : mode === "publication" ? "Other lineup reports" : "More lineup reports";
  return <section aria-label={label}>
    <h3>{label}</h3>
    <p>{mode === "game"
      ? "Lineup reports matched to a game in this range. Some were posted before game day."
      : mode === "publication"
        ? "Practice lines and reports not matched to a game, by the date they were posted."
        : "Individual and practice reports from our wider archive, by the date they were posted. These aren’t matched to games."}</p>
    {status === "loading" && <p role="status">Loading reports…</p>}
    {status === "error" && <p role="alert">Couldn’t load reports.{items.length > 0 && " Reports already shown stay visible."}</p>}
    {status === "disabled" && <p role="status">Reported lines aren’t available right now.</p>}
    {status === "success" && items.length === 0 && <p role="status">No reports found for this range so far.</p>}
    {status === "success" && items.length > 0 && <p role="status">{items.length} {items.length === 1 ? "report" : "reports"} loaded.{nextCursor ? " More are available." : ""}</p>}
    {SHOW_DIAGNOSTICS && mode === "claimPublication" && scanned > 0 && <p>{scanned} retained interpretations checked for publication dates in this range.{nextCursor && " More records remain to be checked."}</p>}
    {SHOW_DIAGNOSTICS && skipped > 0 && <p role="status">{skipped} retained records could not be shown because their dates or contents could not be verified.</p>}
    {dated.length > 0 && <div>{mode !== "game" && <h4>Posted in this range</h4>}{dated.map(item => <Report key={item.id} item={item} observedUnits={observedUnits} qualifiedGameIds={qualifiedGameIds} />)}</div>}
    {unknown.length > 0 && <div>
      <h4>Posting date unconfirmed</h4>
      <p>These reports are filed under dates in this range, but we can’t confirm when they were first posted.</p>
      {unknown.map(item => <Report key={item.id} item={item} />)}
    </div>}
    {status !== "disabled" && (status === "idle" || status === "error" || status === "loading" || nextCursor) &&
      <button type="button" disabled={status === "loading"} onClick={load}>
        {status === "error" ? "Try again" : items.length > 0 || nextCursor ? "Load more reports" : mode === "game" ? "Load game-day lineups" : mode === "publication" ? "Load other reports" : "Browse more reports"}
      </button>}
  </section>;
}

export default function LineHistory(props: Props) {
  const [mode, setMode] = useState<"game" | "publication">("game");
  return <section className={styles.history} aria-label="Reported line history">
    <h2>Reported line history</h2>
    <p>{props.teamName} · {formatScopeDate(props.startDate, false)} to {formatScopeDate(props.endDate, true)}, Eastern time. The opponent and home/away filters only change the matrix.</p>
    <p>These are lineups as reported: projected, practice and game-day. They show what was reported, not who actually shared the ice, and our archive may be missing some reports.</p>
    <label>Group reports by{" "}<select value={mode} onChange={event => setMode(event.target.value as "game" | "publication")}>
      <option value="game">Game date</option>
      <option value="publication">Publication date</option>
    </select></label>
    {mode === "game" && <HistoryList key="game" {...props} mode="game" />}
    <HistoryList key="publication" {...props} mode="publication" />
    <HistoryList key="claimPublication" {...props} mode="claimPublication" />
  </section>;
}
