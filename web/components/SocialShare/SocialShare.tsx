/* eslint-disable @next/next/no-img-element -- Native owned SVG is decoded and embedded by html-to-image for exact PNG exports. */
import { useCallback, useEffect, useRef, useState } from "react";
import type { SocialShareFormat, SocialShareSnapshot, ShareTeamRow } from "lib/socialShare/types";
import { calendarWeekStart, selectScheduleDates, weekDates } from "lib/socialShare/schedule";
import { bounded, downloadSharePng, readyShareFonts, SHARE_SIZE } from "lib/socialShare/export";
import styles from "./SocialShare.module.scss";

const labels: Record<SocialShareFormat, string> = {
  "game-grid": "Weekly schedule", "remaining-week": "Remaining week",
  "tuesday-trends": "Tuesday trends", "player-spotlight": "Player spotlight", "category-rescue": "Category rescue",
};
const dateLabel = (date: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
const yearDateLabel = (date: string) => `${dateLabel(date)}, ${date.slice(0, 4)}`;
const timeLabel = (value: string | null) => value ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York", timeZoneName: "short" }).format(new Date(value)) : "Not available";
const scoreLabel = (row: ShareTeamRow) => row.remainingGames ? row.score.toFixed(1) : "No games";

function futureItinerary(snapshot: SocialShareSnapshot, row: ShareTeamRow) {
  return row.games.filter(game => snapshot.selectedDates.includes(game.date) && game.gameType === 2 && game.status === "scheduled" && game.startTimeUtc !== null && Date.parse(game.startTimeUtc) > Date.parse(snapshot.generatedAt))
    .sort((a, b) => Date.parse(a.startTimeUtc!) - Date.parse(b.startTimeUtc!));
}

function altText(snapshot: SocialShareSnapshot, rows: ShareTeamRow[], trusted: boolean, teamFocus: boolean) {
  const itinerary = teamFocus && rows[0] ? ` Selected future regular-season itinerary: ${futureItinerary(snapshot, rows[0]).map(game => {
    const home = game.homeTeam.id === rows[0].team.id;
    const day = snapshot.days.find(item => item.date === game.date)!;
    return `${yearDateLabel(game.date)}, ${home ? "home vs" : "away at"} ${home ? game.awayTeam.name : game.homeTeam.name}, ${timeLabel(game.startTimeUtc)}, ${day.offNight ? "off-night" : "busy night"} (${day.leagueGames} games on the full NHL slate)`;
  }).join("; ")}.` : "";
  return `FHFH ${labels[snapshot.format]}, ${yearDateLabel(snapshot.weekStart)} through ${yearDateLabel(snapshot.weekEnd)}. ${trusted ? "Schedule only" : "Unranked preview only; source or edition is not ready"}, remaining games after ${timeLabel(snapshot.generatedAt)}. Selected dates: ${snapshot.selectedDates.map(dateLabel).join(", ") || "none"}. ${rows.map(row => `${row.team.name}: ${row.remainingGames} ${trusted ? "remaining" : "known remaining"} games, ${row.offNightGames} ${trusted ? "" : "known "}off-night games${trusted ? `, Schedule Score ${scoreLabel(row)}` : "; ranking unavailable"}`).join("; ")}.${itinerary} NHL schedule checked ${timeLabel(snapshot.source.fetchedAt)}. Off-night density uses the full daily slate. Observed schedule only. No odds or player projections.`;
}

export default function SocialShare({ format, asOf }: { format: SocialShareFormat; asOf: string }) {
  const supported = format === "game-grid" || format === "remaining-week";
  const [weekStart, setWeekStart] = useState(() => calendarWeekStart(asOf));
  const [snapshot, setSnapshot] = useState<SocialShareSnapshot | null>(null);
  const [loading, setLoading] = useState(supported);
  const [error, setError] = useState("");
  const [assetError, setAssetError] = useState("");
  const [assetsReady, setAssetsReady] = useState(false);
  const [logo, setLogo] = useState<string | null>(null);
  const [focusTeam, setFocusTeam] = useState("");
  const [exporting, setExporting] = useState(false);
  const [expired, setExpired] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [scale, setScale] = useState(0);
  const preview = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);
  const selectedRef = useRef<string[] | undefined>(undefined);

  const prepareAssets = useCallback(async () => {
    setAssetsReady(false); setAssetError("");
    try {
      await readyShareFonts();
      const image = new Image(); image.src = "/pictures/logo-fhfh.svg";
      try { await bounded(image.decode(), "Logo unavailable", 5000); setLogo(image.naturalWidth ? image.src : null); }
      catch { setLogo(null); }
      setAssetsReady(true);
    } catch (cause) { setAssetError(cause instanceof Error ? cause.message : "Preview assets unavailable."); }
  }, []);

  const load = useCallback(async (week: string, dates?: string[]) => {
    const id = ++requestId.current;
    setLoading(true); setError(""); setFeedback("");
    const query = new URLSearchParams({ weekStart: week });
    if (dates !== undefined) query.set("selectedDates", dates.join(","));
    try {
      const response = await bounded(fetch(`/api/v1/social-share/${format}?${query}`, { cache: "no-store" }), "Schedule request timed out. Retry this edition.", 20000);
      const next = await response.json();
      if (!response.ok) throw new Error(next.error || "Schedule could not be loaded.");
      if (id !== requestId.current) return;
      setSnapshot(next); selectedRef.current = next.selectedDates; setFocusTeam("");
    } catch (cause) { if (id === requestId.current) setError(cause instanceof Error ? cause.message : "Schedule unavailable."); }
    finally { if (id === requestId.current) setLoading(false); }
  }, [format]);

  useEffect(() => {
    const requests = requestId;
    if (supported) { void prepareAssets(); void load(calendarWeekStart(asOf)); }
    return () => { requests.current++; };
  }, [asOf, supported, load, prepareAssets]);
  useEffect(() => {
    if (!snapshot?.expiresAt) { setExpired(true); return; }
    const remaining = Date.parse(snapshot.expiresAt) - Date.now();
    setExpired(remaining <= 0);
    const timer = window.setTimeout(() => setExpired(true), Math.max(0, remaining));
    return () => clearTimeout(timer);
  }, [snapshot]);
  useEffect(() => {
    if (!frame.current) return;
    const observer = new ResizeObserver(entries => setScale(Math.min(1, entries[0].contentRect.width / SHARE_SIZE)));
    observer.observe(frame.current); return () => observer.disconnect();
  }, [supported]);

  function select(dates: string[]) {
    if (!snapshot || snapshot.weekStart !== weekStart) return;
    selectedRef.current = dates; setSnapshot(selectScheduleDates(snapshot, dates)); setFeedback("");
  }
  const snapshotMatchesWeek = snapshot?.weekStart === weekStart;
  const trusted = !!snapshot && snapshotMatchesWeek && snapshot.state === "ready" && snapshot.source.state === "ready" && !expired && !error;
  const displayRows = snapshot ? (trusted ? snapshot.rows : [...snapshot.rows].sort((a, b) => a.team.abbreviation.localeCompare(b.team.abbreviation))) : [];
  const rows = focusTeam ? displayRows.filter(row => String(row.team.id) === focusTeam && row.remainingGames > 0) : displayRows.filter(row => row.remainingGames > 0).slice(0, 3);
  const itinerary = snapshot && focusTeam && rows[0] ? futureItinerary(snapshot, rows[0]) : [];
  const canExport = trusted && assetsReady && !loading && !!snapshot?.selectedDates.length && rows.some(row => row.remainingGames > 0);
  const changeWeek = (value: string) => {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
    const monday = calendarWeekStart(`${value}T16:00:00Z`);
    setWeekStart(monday); selectedRef.current = undefined; void load(monday);
  };

  return <div className={styles.page}>
    <header className={styles.heading}><div><p className={styles.eyebrow}>FHFH / Share studio</p><h1>{labels[format]}</h1></div><span className={styles.scope}>{supported ? "Schedule only · NHL schedule source" : "Source qualification pending"}</span></header>
    {!supported ? <section className={styles.panel}><h2>Source qualification required</h2><p>This format is blocked until current-season player data, dated ownership evidence, participation and provider rights qualify. No player rankings are available.</p><a href="/social-share/game-grid">Open the schedule studio</a></section> : <>
      <section className={styles.panel} aria-label="Schedule settings">
        <div className={styles.controls}>
          <label>Week of (Monday)<input type="date" value={weekStart} onChange={event => changeWeek(event.target.value)} disabled={loading || exporting} /></label>
          <button type="button" disabled={loading || exporting} onClick={() => void load(weekStart, selectedRef.current)}>Refresh schedule</button>
          <label>Graphic<select value={focusTeam} onChange={event => { setFocusTeam(event.target.value); setFeedback(""); }} disabled={!snapshot || loading || exporting}>
            <option value="">{trusted ? "Top three schedule leaders" : "Known schedule context (unranked)"}</option>{snapshot?.teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
          </select></label>
        </div>
        <fieldset className={styles.days} disabled={!snapshot || !snapshotMatchesWeek || loading || exporting}><legend>Selected days · America/New_York</legend>
          {(snapshot?.days || weekDates(weekStart).map((date, index) => ({ date, label: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][index], selected: false, leagueGames: 0, offNight: false }))).map(day => <button type="button" key={day.date} aria-pressed={day.selected} onClick={() => select(snapshot!.selectedDates.includes(day.date) ? snapshot!.selectedDates.filter(date => date !== day.date) : [...snapshot!.selectedDates, day.date])}>
            <strong>{day.label.slice(0, 3)}</strong><span>{dateLabel(day.date)}</span><small>{day.selected ? "ON" : "OFF"}{snapshot ? ` · ${day.leagueGames} games` : ""}</small>
          </button>)}
          <button type="button" onClick={() => select(snapshot!.days.map(day => day.date))}>All days</button><button type="button" onClick={() => select([])}>None</button>
        </fieldset>
        {format === "remaining-week" && <p>Default: Monday, Tuesday and Wednesday OFF; Thursday–Sunday ON. Remaining games use the edition’s frozen time.</p>}
      </section>
      <div className={styles.status} aria-live="polite">
        {loading && <p>Loading a new schedule edition…</p>}
        {error && <p role="alert">{error} <button type="button" disabled={loading || exporting} onClick={() => void load(weekStart, selectedRef.current)}>Retry schedule</button></p>}
        {snapshot && <><p>NHL schedule checked {timeLabel(snapshot.source.fetchedAt)} · Provider update {timeLabel(snapshot.source.updatedAt)} · Remaining after {timeLabel(snapshot.generatedAt)}</p>
          {!snapshotMatchesWeek && <p>Showing the previous week, {yearDateLabel(snapshot.weekStart)} – {yearDateLabel(snapshot.weekEnd)}, as context. Load the requested week to select its days.</p>}
          {snapshot.state !== "ready" && <p>Schedule {snapshot.state}: {[...snapshot.reasons, ...snapshot.source.reasons].join(" ")}</p>}
          {expired && <p>This edition has expired. Refresh the schedule to download.</p>}
          {!snapshot.selectedDates.length ? <p>No days selected. Choose days to compare schedule opportunities.</p> : !snapshot.rows.some(row => row.remainingGames > 0) && <p>No remaining eligible games on the selected dates.</p>}
        </>}
        {assetError && <p role="alert">{assetError} <button type="button" disabled={exporting} onClick={() => void prepareAssets()}>Retry preview preparation</button></p>}
      </div>
      <div className={styles.workspace}>
        <section className={styles.panel} aria-label="Graphic preview">
          <div className={styles.panelHeader}><h2>1080 × 1080 preview</h2><span>{!trusted ? "Unranked context" : focusTeam ? "Team focus" : "Schedule leaders"}</span></div>
          <div className={styles.previewFrame} ref={frame} style={{ height: scale * SHARE_SIZE }}>
            {snapshot && assetsReady && <div ref={preview} className={styles.square} style={{ transform: `scale(${scale})` }} data-testid="share-square" role="img" aria-label={altText(snapshot, rows, trusted, !!focusTeam)}>
              <div className={styles.squareBrand}>{logo ? <img src={logo} alt="FHFH" width="162" height="48" /> : <strong>FHFH</strong>}<span>FHFHOCKEY.COM</span></div>
              <div className={styles.squareTitle}><p>{trusted ? "Schedule only" : "Unranked context"} / {labels[format]}</p><h2>{!trusted ? "KNOWN SCHEDULE\nCONTEXT" : focusTeam ? "YOUR TEAM’S\nOPPORTUNITY" : "THE WEEK’S\nSCHEDULE EDGE"}</h2><p>{yearDateLabel(snapshot.weekStart)} – {yearDateLabel(snapshot.weekEnd)} · {trusted ? "Remaining games" : "Known games · Ranking unavailable"}</p></div>
              <div className={styles.leaders}>{rows.length ? rows.map(row => <div key={row.team.id} className={styles.leader}>
                <div className={styles.teamIdentity}><span className={styles.rank}>{trusted ? `#${row.rank} / ` : "UNRANKED / "}{row.team.abbreviation}</span><h3>{row.team.name}</h3></div>
                <div className={styles.metrics}><div><strong>{row.remainingGames}</strong><span>{trusted ? "GAMES LEFT" : "KNOWN LEFT"}</span></div><div><strong>{row.offNightGames}</strong><span>{trusted ? "OFF-NIGHTS" : "KNOWN OFF-NIGHTS"}</span></div><div><strong>{trusted ? scoreLabel(row) : "—"}</strong><span>{trusted ? "SCHEDULE SCORE" : "SCORE UNAVAILABLE"}</span></div></div>
              </div>) : <p className={styles.noGames}>{snapshot.selectedDates.length ? "No remaining games" : "No days selected"}</p>}
              {!!itinerary.length && <div className={styles.itinerary}><h3>SELECTED FUTURE GAMES</h3><div className={styles.itineraryGames}>{itinerary.slice(0, 8).map(game => {
                const home = game.homeTeam.id === rows[0].team.id;
                const day = snapshot.days.find(item => item.date === game.date)!;
                return <div key={game.id}><strong>{dateLabel(game.date)} · {home ? "HOME vs" : "AWAY @"} {home ? game.awayTeam.abbreviation : game.homeTeam.abbreviation}</strong><span>{day.offNight ? "Off-night" : "Busy night"} · {day.leagueGames} NHL games</span></div>;
              })}</div>{itinerary.length > 8 && <p>+{itinerary.length - 8} more selected games · Full itinerary on this page</p>}</div>}
              </div>
              <footer className={styles.squareFooter}><p><strong>SELECTED</strong> {snapshot.selectedDates.map(dateLabel).join(" · ") || "None"}</p><p>Remaining after {timeLabel(snapshot.generatedAt)}</p><p>NHL schedule checked {timeLabel(snapshot.source.fetchedAt)}</p><p>Score uses games, off-nights and slate density. No odds or player projections.</p><strong className={styles.watermark}>{!trusted ? "PREVIEW ONLY · REFRESH / CHECK SOURCE" : "SCHEDULE ONLY"}</strong></footer>
            </div>}
            {!assetsReady && <p>Preparing local fonts and branding…</p>}
          </div>
          <div className={styles.actions}><button type="button" disabled={!canExport || exporting} onClick={async () => {
            if (!preview.current || !snapshot) return; setExporting(true); setFeedback("");
            try { await downloadSharePng(preview.current, snapshot); setFeedback("PNG downloaded: 1080 × 1080."); }
            catch (cause) { setFeedback(cause instanceof Error ? cause.message : "Download failed. Retry the same edition."); }
            finally { setExporting(false); }
          }}>{exporting ? "Creating PNG…" : "Download PNG"}</button>
          <button type="button" disabled={!snapshot || exporting} onClick={async () => {
            try { await navigator.clipboard.writeText(altText(snapshot!, rows, trusted, !!focusTeam)); setFeedback("Alt text copied."); }
            catch { setFeedback("Alt text could not be copied. Select and copy the text below."); }
          }}>Copy alt text</button></div><p role="status">{feedback}</p>
          {snapshot && <details><summary>Suggested alt text</summary><p>{altText(snapshot, rows, trusted, !!focusTeam)}</p></details>}
        </section>
        <section className={styles.panel} aria-label="Complete ranked schedule"><div className={styles.panelHeader}><h2>All teams</h2><span>{snapshot?.rows.length || 0} teams</span></div>
          <p className={styles.explanation}>Schedule Score compares remaining selected games, off-night games and full-slate density. Odds and player projections are excluded. Zero-game teams have no score to publish. Matchups below include context; elapsed, live, postponed and nonregular games do not count as opportunities.</p>
          <ol className={styles.teamList}>{displayRows.map(row => <li key={row.team.id}><div><strong>{trusted ? `#${row.rank} ` : ""}{row.team.name}</strong><span>{row.remainingGames} {trusted ? "left" : "known left"} · {row.offNightGames} {trusted ? "off-night" : "known off-night"} · {trusted ? `Score ${scoreLabel(row)}` : "Unranked; score unavailable"}</span></div><p>{row.games.filter(game => snapshot!.selectedDates.includes(game.date)).map(game => `${dateLabel(game.date)} ${game.homeTeam.id === row.team.id ? "vs" : "@"} ${game.homeTeam.id === row.team.id ? game.awayTeam.abbreviation : game.homeTeam.abbreviation} (${game.status}${game.gameType !== 2 ? ", nonregular" : ""}; ${timeLabel(game.startTimeUtc)})`).join(" · ") || "No games on selected dates"}</p></li>)}</ol>
        </section>
      </div>
    </>}
  </div>;
}
