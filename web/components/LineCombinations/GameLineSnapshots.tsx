import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { EntryRevision, EntryView, GameLinesResponse, GameTeamLines, LineClaim, LineGame, PPDecision, PPEndReason, SelectedLineUnit } from "lib/lines/types";
import type { TweetUnit } from "lib/sources/tweetInterpretation";
import SourceFeed from "./SourceFeed";
import { ORIGINAL_SOURCE_PENDING, formatTime, gameLabel, originalPostUrl, reviewReasonsCopy, revisionReasonCopy, shortDate, sourceAuthor } from "./reviewReasonCopy";
import styles from "./ProjectedLineups.module.scss";

export { gameLabel } from "./reviewReasonCopy";

export function mergeFrozenEntries(previous: GameLinesResponse | null, incoming: GameLinesResponse): GameLinesResponse {
  if (!previous || previous.game?.id !== incoming.game?.id) return incoming;
  return { ...incoming, teams: incoming.teams.map((team) => {
    const entry = previous.teams.find((candidate) => candidate.teamId === team.teamId)?.entry;
    if (!entry || entry.status === "expected" || entry.id === team.entry?.id) return team;
    const revisions = new Map(team.entryRevisions.map((revision) => [revision.id, revision]));
    let current = team.entry;
    const seen = new Set<string>();
    while (current && current.id !== entry.id && !seen.has(current.id)) {
      seen.add(current.id);
      if (current.status !== "corrected" || !current.previousId) break;
      current = revisions.get(current.previousId) ?? null;
    }
    return current?.id === entry.id ? team : { ...team, entry, unresolved: [...team.unresolved, { claimId: entry.id, reasons: ["Entry revision changed without a verified correction chain; the frozen entry is retained"] }] };
  }) };
}

const NARROW_QUERY = "(max-width: 799px)";
function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const query = window.matchMedia(NARROW_QUERY);
    const update = () => setNarrow(query.matches);
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);
  return narrow;
}

const PHASE_COPY: Record<LineGame["phase"], string> = { scheduled: "Scheduled", pregame: "Pregame", live: "Live", final: "Final", postponed: "Postponed", unknown: "Game state unknown" };

function unitLabel(unit: TweetUnit): string {
  const number = unit.number == null ? ", unassigned" : ` ${unit.number}`;
  switch (unit.situation) {
    case "es_forward": return `Line${number}`;
    case "es_defense": return `Pair${number}`;
    case "pp": return `PP${number}`;
    case "pk": return `PK${number}`;
    case "goalie": return "Goalies";
    case "scratch": return "Scratches";
    case "injury": return "Injured";
  }
}
/** Player names joined by dashes; lines wrap only between players, never inside a name (non-breaking spaces). */
function names(unit: TweetUnit): string { return unit.players.map((player) => player.name.trim().replace(/\s+/g, "\u00a0")).join("\u00a0— "); }
/** Original author only; a relay account is never shown as the source. */
function authorOf(claim: LineClaim): string | null { return sourceAuthor(claim.originalAuthor !== undefined ? claim.originalAuthor : claim.author); }

function Source({ claim }: { claim: LineClaim }) {
  const author = authorOf(claim);
  const href = author ? originalPostUrl(author, claim.provenance?.originalTweetId, claim.sourceUrl) : null;
  if (!author) return <span className={styles.source}>{ORIGINAL_SOURCE_PENDING}</span>;
  return href
    ? <a className={styles.source} href={href} target="_blank" rel="noreferrer">@{author}</a>
    : <span className={styles.source}>@{author}</span>;
}
function ClaimTime({ claim }: { claim: LineClaim }) {
  const value = claim.time.originalPublishedAt;
  return <span className={styles.muted}>{value ? <time dateTime={value}>{formatTime(value)}</time> : `${claim.time.rawDisplay ?? "Post time unknown"} · time zone unknown`}</span>;
}
function Sources({ claims }: { claims: LineClaim[] }) {
  return <>{claims.map((claim) => <span key={claim.id} className={styles.sourceItem}><Source claim={claim} /> <ClaimTime claim={claim} /></span>)}</>;
}

type Status = { label: string; tone: "confirmed" | "projected" | "practice" | "carried" | "derived" | "reported" };
function unitStatus(selection: SelectedLineUnit, games: LineGame[], decision?: PPDecision): Status {
  if (decision?.derivation) return { label: "Derived from PP swap", tone: "derived" };
  if (selection.designation === "carried") {
    const origin = games.find((game) => game.id === selection.originGameId);
    return { label: `Carried forward from ${origin ? gameLabel(origin) : "an earlier game"}`, tone: "carried" };
  }
  if (selection.claims.some((claim) => claim.context === "practice")) return { label: "Practice report, not game-confirmed", tone: "practice" };
  // Goalie lists confirm who dressed, never who starts.
  if (selection.designation === "confirmed") return { label: selection.unit.situation === "goalie" ? "Tandem confirmed" : "Confirmed", tone: "confirmed" };
  if (selection.designation === "projected") return { label: "Projected", tone: "projected" };
  return { label: "Reported", tone: "reported" };
}
const TONE_CLASS: Record<Status["tone"], string | undefined> = {
  confirmed: styles.chipConfirmed, projected: styles.chipProjected, practice: styles.chipPractice, carried: styles.chipCarried, derived: styles.chipDerived, reported: undefined,
};

function endReasonCopy(reason: PPEndReason): string {
  if (reason.kind === "superseded") return "a newer report replaced it";
  if (reason.kind === "player_unavailable") return "a carried player is out of the lineup";
  return `not reaffirmed in ${reason.gamesElapsed} team games`;
}

function UnitRow({ selection, games, decision, hideSource = false }: { selection: SelectedLineUnit; games: LineGame[]; decision?: PPDecision; hideSource?: boolean }) {
  const unit = selection.unit;
  const status = unitStatus(selection, games, decision);
  const derivation = decision?.derivation;
  const base = derivation ? selection.claims.filter((claim) => derivation.baseClaimIds.includes(claim.id)) : [];
  const swap = derivation ? selection.claims.filter((claim) => derivation.swapClaimIds.includes(claim.id)) : [];
  return <li className={styles.unitRow}>
    <span className={styles.unitLabel}>{unitLabel(unit)}</span>
    <div className={styles.unitBody}>
      <strong className={styles.players}>{names(unit)}</strong>
      <p className={styles.meta}>
        <span className={[styles.chip, TONE_CLASS[status.tone]].filter(Boolean).join(" ")}>{status.label}</span>
        {!unit.complete && <span className={styles.chip}>Partial</span>}
        {unit.situation === "goalie" && <span className={styles.chip}>Starter not confirmed</span>}
      </p>
      {derivation && (base.length || swap.length)
        ? <p className={styles.sourceLine}>{!!base.length && <>Base unit: <Sources claims={base} /></>}{!!swap.length && <> Swap: <Sources claims={swap} /></>}</p>
        : !hideSource && <p className={styles.sourceLine}><Sources claims={selection.claims} /></p>}
    </div>
  </li>;
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  // A labelled group, not a landmark: the h3 already gives navigation, and region names like
  // "Forwards" would collide with the legacy grid's sections on the team page.
  return <div role="group" className={styles.group} aria-labelledby={id}>
    <h3 id={id} className={styles.groupTitle}>{title}</h3>
    {children}
  </div>;
}

const ES_GROUPS: Array<{ title: string; match: (unit: TweetUnit) => boolean }> = [
  { title: "Forwards", match: (unit) => unit.situation === "es_forward" },
  { title: "Defence", match: (unit) => unit.situation === "es_defense" },
  { title: "Goalies", match: (unit) => unit.situation === "goalie" },
  { title: "Other", match: (unit) => unit.situation === "pk" || unit.situation === "scratch" || unit.situation === "injury" },
];

function EsGroups({ units, games }: { units: SelectedLineUnit[]; games: LineGame[] }) {
  return <>{ES_GROUPS.map((group) => {
    const rows = units.filter((selection) => group.match(selection.unit));
    // When every row comes from the same report(s), name the source once under the group heading.
    const signature = (selection: SelectedLineUnit) => selection.claims.map((claim) => claim.id).sort().join("|");
    const shared = rows.length > 1 && !!rows[0]!.claims.length && rows.every((selection) => signature(selection) === signature(rows[0]!)) ? rows[0]!.claims : null;
    return rows.length ? <Group key={group.title} title={group.title}>
      {shared && <p className={styles.groupSource}>Source: <Sources claims={shared} /></p>}
      <ul className={styles.units}>{rows.map((selection, index) => <UnitRow key={`${selection.unit.situation}:${selection.unit.number}:${index}`} selection={selection} games={games} hideSource={!!shared} />)}</ul>
    </Group> : null;
  })}</>;
}

function ppEmptyCopy(number: number, decision: PPDecision | undefined): string {
  if (decision?.conflict) return `Sources disagree on PP${number}.`;
  if (decision?.reason?.startsWith("PP swap observed")) return `A PP${number} swap was reported, but there's no full unit to apply it to yet.`;
  return `No PP${number} report yet.`;
}

function PowerPlay({ team, games }: { team: GameTeamLines; games: LineGame[] }) {
  const entryPP = (team.entry?.units ?? []).filter((selection) => selection.unit.situation === "pp");
  const numbers = [...new Set([1, 2, ...team.ppDefaults.map((decision) => decision.unitNumber)])].sort((a, b) => a - b);
  const anyCarried = team.ppDefaults.some((decision) => decision.selection?.designation === "carried");
  return <>{numbers.map((number) => {
    const decision = team.ppDefaults.find((candidate) => candidate.unitNumber === number);
    const selection = decision?.selection ?? entryPP.find((candidate) => candidate.unit.number === number) ?? null;
    return <Group key={number} title={`Power play ${number}`}>
      {selection
        ? <ul className={styles.units}><UnitRow selection={selection} games={games} decision={decision?.selection ? decision : undefined} /></ul>
        : <p className={styles.muted}>{ppEmptyCopy(number, decision)}</p>}
      {decision?.endReason && <p className={styles.notice}>Carried PP{number} ended: {endReasonCopy(decision.endReason)}.</p>}
    </Group>;
  })}
  {anyCarried && <p className={styles.muted}>Carried units come from an earlier game and haven&apos;t been confirmed for this one.</p>}</>;
}

function Entry({ team, games, entryView }: { team: GameTeamLines; games: LineGame[]; entryView?: EntryView }) {
  const headingId = useId();
  const entry = team.entry;
  const entering = entryView ? entryView.mode === "entering" : entry?.status === "frozen" || entry?.status === "corrected";
  const esUnits = (entry?.units ?? []).filter((selection) => selection.unit.situation !== "pp");
  const fallback = !entry?.units.length ? team.fallback : null;
  const fallbackGame = fallback ? games.find((game) => game.id === fallback.gameId) : null;
  return <section className={styles.entry} aria-labelledby={headingId}>
    <h2 id={headingId} className={styles.entryTitle}>{team.abbreviation} · {entering ? "Lineup entering the game" : "Expected game-entry lineup"}</h2>
    {entering && entryView?.frozenAt && <p className={styles.muted}>Set at <time dateTime={entryView.frozenAt}>{formatTime(entryView.frozenAt)}</time></p>}
    {entry?.status === "corrected" && <p className={styles.notice}>Lineup corrected · revision {entry.revision} · {revisionReasonCopy(entry.reason)}</p>}
    {!esUnits.length && !fallback && <p className={styles.muted}>No game-entry lineup has been reported yet.</p>}
    <EsGroups units={esUnits} games={games} />
    {!!entry?.conflicts.length && <p className={styles.notice}>Sources disagree on part of this lineup. Those units stay out until it&apos;s settled.</p>}
    {fallback && <Group title={`Previous game's lineup · ${shortDate(fallback.date)}`}>
      <p className={styles.muted}>From {fallbackGame ? gameLabel(fallbackGame) : "the previous game"}. Nothing has been reported for this game yet.</p>
      <ul className={styles.units}>{fallback.entry.units.map((selection, index) => <UnitRow key={`${selection.unit.situation}:${selection.unit.number}:${index}`} selection={selection} games={games} />)}</ul>
    </Group>}
    <PowerPlay team={team} games={games} />
    {team.entryRevisions.length > 1 && <details className={styles.history}>
      <summary>Revision history ({team.entryRevisions.length})</summary>
      <ol className={styles.revisions}>{team.entryRevisions.map((revision: EntryRevision) => <li key={revision.id}>
        <p className={styles.itemTitle}>Revision {revision.revision} · {revision.status === "frozen" ? "Set at puck drop" : revision.status === "corrected" ? "Corrected" : "Expected"}</p>
        <p className={styles.muted}>{revisionReasonCopy(revision.reason)} · <time dateTime={revision.createdAt}>{formatTime(revision.createdAt)}</time></p>
        <ul className={styles.units}>{revision.units.map((selection, index) => <UnitRow key={`${selection.unit.situation}:${selection.unit.number}:${index}`} selection={selection} games={games} />)}</ul>
      </li>)}</ol>
    </details>}
  </section>;
}

const KIND_COPY: Record<LineClaim["kind"], string> = { entry: "Lineup report", iga: "In-game change", pp: "Power play", entry_correction: "Lineup correction", retraction: "Retraction" };
const RELATION_COPY: Record<string, string> = { continuity: "Together", substitution: "Substitution", swap: "Swap", alternatives: "Alternating" };

function ClaimRow({ claim, games, selectedGameId }: { claim: LineClaim; games: LineGame[]; selectedGameId: number | null }) {
  const unit = claim.unit;
  const subject = unit ? unitLabel(unit) : claim.relationship ? RELATION_COPY[claim.relationship.kind] ?? "Line note" : "Line note";
  const phase = claim.phase === "pregame" ? "Before the game" : claim.phase === "in_game" ? "During the game" : "Timing unclear";
  const game = claim.binding.status === "bound" ? games.find((candidate) => candidate.id === claim.gameId) : null;
  const applies = claim.binding.status !== "bound" ? "Game not identified"
    : claim.gameId === selectedGameId || !game ? "This game" : `Applies to ${gameLabel(game)}`;
  const observed = claim.binding.status === "bound" && claim.phase === "in_game" && !claim.reviewReasons.length && claim.accepted;
  const review = reviewReasonsCopy(claim.reviewReasons);
  const designation = claim.context === "practice" ? "Practice report, not game-confirmed"
    : claim.certainty === "confirmed" && claim.confirmationEvidence.length ? "Confirmed" : claim.certainty === "projected" ? "Projected" : "Reported";
  const label = `${KIND_COPY[claim.kind]} · ${subject}`;
  return <div role="group" aria-label={label} className={styles.claim}>
    <p className={styles.claimTitle}>{label}{unit && !unit.complete && <span className={styles.chip}>Partial</span>}
      {observed && <span className={[styles.chip, styles.chipConfirmed].join(" ")}>Observed in game</span>}</p>
    {unit && <p className={styles.players}>{names(unit)}</p>}
    {claim.relationship && <p className={styles.players}>{claim.relationship.evidence.text}</p>}
    <p className={styles.muted}>{phase} · {applies} · {designation}</p>
    {!!review.length && <div className={styles.review}><p>Needs review</p><ul>{review.map((line) => <li key={line}>{line}</li>)}</ul></div>}
    {(claim.supersedes.length > 0 || claim.retracts.length > 0) && <p className={styles.notice}>Corrects an earlier report. The original stays in the history.</p>}
  </div>;
}

function captureTime(claims: LineClaim[]): number { return Date.parse(claims[0]!.time.originalPublishedAt ?? claims[0]!.time.ingestedAt) || 0; }

/** Interpreted reports. Every report renders; the panel scrolls instead of paging. */
function UpdateList({ team, games, selectedGameId }: { team: GameTeamLines; games: LineGame[]; selectedGameId: number | null }) {
  const [history, setHistory] = useState(false);
  const claims = history ? team.history : team.observations;
  const groups = new Map<string, LineClaim[]>();
  for (const claim of claims) groups.set(claim.captureId, [...groups.get(claim.captureId) ?? [], claim]);
  const reports = [...groups.values()].sort((a, b) => captureTime(b) - captureTime(a) || a[0]!.id.localeCompare(b[0]!.id));
  const unresolved = reviewReasonsCopy(team.unresolved.flatMap((issue) => issue.reasons));
  return <>
    <p className={styles.muted}>What each report means for the lineup. The game-entry lineup stays as it was set.</p>
    <button type="button" className={styles.historyButton} aria-pressed={history} onClick={() => setHistory(!history)}>
      {history ? "Show in-game updates only" : `Show all reports (${new Set(team.history.map((claim) => claim.captureId)).size})`}
    </button>
    {!reports.length && <p className={styles.muted}>No {history ? "reports" : "in-game updates"} yet.</p>}
    {!!reports.length && <ol className={styles.reportList} aria-label={`${team.abbreviation} ${history ? "all reports" : "in-game updates"}`}>
      {reports.map((group) => {
        const claim = group[0]!;
        return <li key={claim.captureId} className={styles.report}>
          <p className={styles.itemTitle}><Source claim={claim} /> <ClaimTime claim={claim} /></p>
          {group.map((item) => <ClaimRow key={item.id} claim={item} games={games} selectedGameId={selectedGameId} />)}
          <p className={styles.muted}>Received {formatTime(claim.time.ingestedAt)}</p>
          <details className={styles.rawDetails}><summary>Source text</summary><p className={styles.rawText}>{claim.text}</p></details>
        </li>;
      })}
    </ol>}
    {!!unresolved.length && <details className={styles.history}><summary>Needs review ({unresolved.length})</summary>
      <ul className={styles.reviewList}>{unresolved.map((line) => <li key={line}>{line}</li>)}</ul>
    </details>}
  </>;
}

type TabKey = "updates" | "feed";
function Sidebar({ team, games, selectedGameId }: { team: GameTeamLines; games: LineGame[]; selectedGameId: number | null }) {
  const narrow = useNarrow();
  const base = useId();
  const [tab, setTab] = useState<TabKey>("updates");
  const [open, setOpen] = useState<Record<TabKey, boolean>>({ updates: false, feed: false });
  const tabRefs = useRef<Record<TabKey, HTMLButtonElement | null>>({ updates: null, feed: null });
  const updateCount = new Set(team.observations.map((claim) => claim.captureId)).size;
  const feed = team.feed ?? [];
  const sections: Array<{ key: TabKey; label: string; body: ReactNode }> = [
    { key: "updates", label: `In-game updates (${updateCount})`, body: <UpdateList team={team} games={games} selectedGameId={selectedGameId} /> },
    { key: "feed", label: `Source feed (${feed.length})`, body: <SourceFeed items={feed} games={games} teamAbbreviation={team.abbreviation} /> },
  ];
  const label = `${team.abbreviation} updates and sources`;
  if (narrow) return <section className={styles.rail} aria-label={label}>
    {sections.map((section) => <section key={section.key} className={styles.collapsible}>
      <h3 className={styles.collapsibleTitle}>
        <button type="button" className={styles.sectionToggle} aria-expanded={open[section.key]} aria-controls={`${base}-${section.key}`}
          onClick={() => setOpen({ ...open, [section.key]: !open[section.key] })}>{section.label}</button>
      </h3>
      <div id={`${base}-${section.key}`} hidden={!open[section.key]} className={styles.collapsibleBody}>{section.body}</div>
    </section>)}
  </section>;
  const keys = sections.map((section) => section.key);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = keys.indexOf(tab);
    const next = event.key === "ArrowRight" ? keys[(index + 1) % keys.length] : event.key === "ArrowLeft" ? keys[(index - 1 + keys.length) % keys.length]
      : event.key === "Home" ? keys[0] : event.key === "End" ? keys[keys.length - 1] : null;
    if (!next) return;
    event.preventDefault(); setTab(next); tabRefs.current[next]?.focus();
  };
  return <section className={styles.rail} aria-label={label}>
    <div role="tablist" aria-label={label} className={styles.tabs} onKeyDown={onKeyDown}>
      {sections.map((section) => <button key={section.key} ref={(element) => { tabRefs.current[section.key] = element; }} type="button" role="tab"
        id={`${base}-${section.key}-tab`} aria-selected={tab === section.key} aria-controls={`${base}-${section.key}-panel`} tabIndex={tab === section.key ? 0 : -1}
        className={styles.tab} onClick={() => setTab(section.key)}>{section.label}</button>)}
    </div>
    {sections.map((section) => <div key={section.key} role="tabpanel" id={`${base}-${section.key}-panel`} aria-labelledby={`${base}-${section.key}-tab`}
      tabIndex={0} hidden={tab !== section.key} className={styles.tabPanel}>{section.body}</div>)}
  </section>;
}

export default function GameLineSnapshots({ data, onGameChange }: { data: GameLinesResponse; onGameChange?: (id: number) => void }) {
  const selectId = useId();
  if (!data.enabled || data.status === "disabled") return null;
  const game = data.game;
  return <section aria-label="Game line combinations" className={styles.snapshots}>
    <header className={styles.gameHeader}>
      <div><label htmlFor={selectId}>Game</label><select id={selectId} value={game?.id ?? ""} onChange={(event) => onGameChange?.(Number(event.target.value))}>
        {!game && <option value="">No live or upcoming game</option>}
        {data.games.map((candidate) => <option value={candidate.id} key={candidate.id}>{gameLabel(candidate)}</option>)}
      </select></div>
      {game && <p className={styles.muted}>{PHASE_COPY[game.phase]}
        {game.observedAt && <> · checked <time dateTime={game.observedAt}>{formatTime(game.observedAt)}</time></>}</p>}
    </header>
    {!game && <p role="status" className={styles.stateEmpty}>No live or upcoming game for this team.{data.games.length ? " Earlier games are in the list above." : ""}</p>}
    {game?.phase === "unknown" && <p role="status" className={styles.stateWarn}>We can&apos;t read the game state right now, so the lineup isn&apos;t locked yet.</p>}
    {data.teams.map((team) => <section aria-label={`${team.abbreviation} lines`} key={`${game?.id}:${team.teamId}`} className={styles.layout}>
      <Entry team={team} games={data.games} entryView={data.entryView} />
      <Sidebar team={team} games={data.games} selectedGameId={game?.id ?? null} />
    </section>)}
  </section>;
}
