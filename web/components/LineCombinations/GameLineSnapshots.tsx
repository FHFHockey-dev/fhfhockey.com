import { useId, useState } from "react";
import type { EntryRevision, GameLinesResponse, GameTeamLines, LineClaim, LineGame, SelectedLineUnit } from "lib/lines/types";
import styles from "./ProjectedLineups.module.scss";

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

export function gameLabel(game: LineGame): string { return `${game.date} · ${game.awayAbbreviation} at ${game.homeAbbreviation}`; }
function Source({ claim }: { claim: LineClaim }) {
  return <span className={styles.source}>{claim.sourceUrl ? <a href={claim.sourceUrl} target="_blank" rel="noreferrer">{claim.author ? `@${claim.author}` : "Original report"}</a> : <span>{claim.author ?? "Source attribution pending"}</span>}</span>;
}
function ClaimTime({ claim }: { claim: LineClaim }) {
  const value = claim.time.originalPublishedAt;
  return <span className={styles.muted}>{value ? <time dateTime={value}>{new Date(value).toLocaleString()}</time> : `${claim.time.rawDisplay ?? "Publication time unavailable"} · timezone unresolved`}</span>;
}
function ClaimStatus({ claim }: { claim: LineClaim }) {
  const label = claim.kind === "entry_correction" ? "Entry correction" : claim.kind === "retraction" ? "Retraction" : claim.kind === "iga" ? "In-game adjustment" : claim.kind === "pp" ? "Power-play report" : "Entry report";
  const unit = claim.unit;
  const unitLabel = unit ? `${unit.situation === "pp" ? "PP" : unit.situation === "es_forward" ? "Line" : unit.situation === "es_defense" ? "Pair" : unit.situation}${unit.number == null ? " · Unassigned" : ` ${unit.number}`}` : claim.relationship ? `Relationship · ${claim.relationship.kind}` : "Source claim";
  const phase = claim.phase === "pregame" ? "Pregame" : claim.phase === "in_game" ? "In game" : "Phase unresolved";
  const review = claim.reviewReasons;
  const designation = claim.certainty === "confirmed" && claim.confirmationEvidence.length ? "Explicitly confirmed" : claim.certainty === "projected" ? "Projected" : "Reported";
  return <section aria-label={`${label} · ${unitLabel}`}>
    <h4>{label} · {unitLabel}</h4>
    {unit && <p className={styles.text}>{unit.players.map((player) => player.name).join(" — ")}{!unit.complete && " · Partial unit"}</p>}
    {claim.relationship && <p className={styles.text}>{claim.relationship.evidence.text}</p>}
    <p className={styles.muted}>{phase} · {claim.binding.status === "bound" ? `Applies to game ${claim.gameId}` : "Game applicability unresolved"}</p>
    {claim.binding.status === "bound" && claim.phase === "in_game" && !review.length && claim.accepted && <p className={styles.muted}>Observed in game</p>}
    <p className={styles.muted}>{designation}</p>
    {!!review.length && <p role="status" className={styles.muted}>Review needed: {review.join(", ")}</p>}
    {(claim.supersedes.length > 0 || claim.retracts.length > 0) && <p className={styles.notice}>Correction/retraction relationship retained in source history.</p>}
  </section>;
}
function Units({ units, games }: { units: SelectedLineUnit[]; games: LineGame[] }) {
  return <ul className={styles.units}>{units.map((selection, index) => {
    const unit = selection.unit;
    const origin = games.find((game) => game.id === selection.originGameId);
    const label = unit.situation === "es_defense" ? "Pair" : unit.situation === "es_forward" ? "Line" : unit.situation === "goalie" ? "Goalie" : unit.situation.toUpperCase();
    return <li key={`${unit.situation}:${unit.number}:${index}`}>
      <span>{label}{unit.number != null ? ` ${unit.number}` : ""}</span>
      <div><strong>{unit.players.map((player) => player.name).join(" — ")}</strong>
        <p className={styles.muted}>{selection.designation === "carried" ? `Carried forward from ${origin ? gameLabel(origin) : `game ${selection.originGameId}`}` : selection.designation === "confirmed" ? "Explicitly confirmed" : selection.designation === "projected" ? "Projected" : "Reported"}
          {!unit.complete && " · Partial unit"}{unit.situation === "goalie" && " · Listed order; starter role requires separate evidence"}</p>
        {selection.claims.map((claim) => <span key={claim.id}><Source claim={claim} /> <ClaimTime claim={claim} /></span>)}
      </div>
    </li>;
  })}</ul>;
}
function Entry({ team, games }: { team: GameTeamLines; games: LineGame[] }) {
  const entry = team.entry;
  const fallback = !entry?.units.length ? team.fallback : null;
  return <div aria-label={`${team.abbreviation} game-entry lineup`}>
    <h2>{team.abbreviation} · {entry?.status === "frozen" || entry?.status === "corrected" ? "Lineup entering the game" : "Expected game-entry lineup"}</h2>
    {entry?.status === "corrected" && <p role="status" className={styles.notice}>Entry lineup corrected · Revision {entry.revision} · {entry.reason}</p>}
    {!entry?.units.length && <p>No applicable game-entry lineup has been recorded.</p>}
    {!!entry?.units.length && <article className={styles.card}><Units units={entry.units} games={games} /></article>}
    {!!entry?.conflicts.length && <p role="status">Conflicting entry reports require review. Affected units remain unresolved.</p>}
    {fallback && <article className={styles.card}><h3>Previous-game fallback · {fallback.date}</h3><p className={styles.muted}>From game {fallback.gameId}. This is prior-game evidence.</p><Units units={fallback.entry.units} games={games} /></article>}
    <article className={styles.card}><h3>Current PP defaults</h3>
      <p className={styles.muted}>Game-specific reports or accepted prior-game observations. Carried units have not been independently confirmed for this game.</p>
      <Units units={team.ppDefaults.flatMap((decision) => decision.selection ? [decision.selection] : [])} games={games} />
      {team.ppDefaults.map((decision) => !decision.selection && <p key={decision.unitNumber}>PP{decision.unitNumber}: {decision.conflict ? "Conflicting reports require review" : "No applicable report"}</p>)}
    </article>
    {team.entryRevisions.length > 1 && <details className={styles.card}><summary>Entry revision history ({team.entryRevisions.length})</summary>
      {team.entryRevisions.map((revision: EntryRevision) => <div key={revision.id}><h3>Revision {revision.revision} · {revision.status}</h3><p className={styles.muted}>{revision.reason} · {revision.createdAt}</p><Units units={revision.units} games={games} /></div>)}
    </details>}
  </div>;
}

function UpdateRail({ team }: { team: GameTeamLines }) {
  const id = useId();
  const [expanded, setExpanded] = useState(true), [limit, setLimit] = useState(8), [history, setHistory] = useState(false);
  const claims = history ? team.history : team.observations;
  const groups = new Map<string, LineClaim[]>();
  for (const claim of claims) { const key = claim.captureId; groups.set(key, [...groups.get(key) ?? [], claim]); }
  const reports = [...groups.values()].sort((a, b) => Date.parse(b[0]!.time.originalPublishedAt ?? b[0]!.time.ingestedAt) - Date.parse(a[0]!.time.originalPublishedAt ?? a[0]!.time.ingestedAt) || a[0]!.id.localeCompare(b[0]!.id));
  const updateCount = new Set(team.observations.map((claim) => claim.captureId)).size;
  return <aside className={styles.rail} aria-label={`${team.abbreviation} in-game updates`}>
    <h2><button className={styles.railToggle} type="button" aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(!expanded)}>In-game updates ({updateCount})</button></h2>
    <div id={id} hidden={!expanded}>
      <p className={styles.muted}>Timestamped evidence. The game-entry lineup stays separate.</p>
      <button type="button" className={styles.historyButton} aria-pressed={history} onClick={() => { setHistory(!history); setLimit(8); }}>{history ? "Show in-game updates" : `Show all source history (${new Set(team.history.map((claim) => claim.captureId)).size})`}</button>
      {!reports.length && <p>No {history ? "source reports" : "in-game updates"} yet.</p>}
      {reports.slice(0, limit).map((group) => {
        const claim = group[0]!;
        return <article key={claim.captureId} className={styles.card}>
          <h3>{team.abbreviation} · Source report</h3>
          <ClaimTime claim={claim} /><p className={styles.text}>{claim.text}</p><Source claim={claim} />
          <p className={styles.muted}>Ingested {claim.time.ingestedAt ? new Date(claim.time.ingestedAt).toLocaleString() : "time unavailable"}</p>
          {group.map((claim) => <ClaimStatus key={claim.id} claim={claim} />)}
        </article>;
      })}
      {reports.length > limit && <button type="button" className={styles.historyButton} onClick={() => setLimit(limit + 8)}>Show earlier updates</button>}
      {!!team.unresolved.length && <details className={styles.card}><summary>Unresolved evidence ({team.unresolved.length})</summary>{team.unresolved.map((issue, index) => <p key={`${issue.claimId}:${index}`} className={styles.muted}>{issue.reasons.join(", ")}</p>)}</details>}
    </div>
  </aside>;
}

export default function GameLineSnapshots({ data, onGameChange }: { data: GameLinesResponse; onGameChange?: (id: number) => void }) {
  const selectId = useId();
  if (!data.enabled) return <p role="status">Game-entry lineup publishing is disabled.</p>;
  return <section aria-label="Game line combinations" className={styles.snapshots}>
    <header className={styles.gameHeader}>
      <div><label htmlFor={selectId}>Game</label><select id={selectId} value={data.game?.id ?? ""} onChange={(event) => onGameChange?.(Number(event.target.value))}>
        {!data.game && <option value="">No live or upcoming game</option>}
        {data.games.map((game) => <option value={game.id} key={game.id}>{gameLabel(game)}</option>)}
      </select></div>
      {data.game && <p className={styles.muted}>{gameLabel(data.game)} · {data.game.phase === "unknown" ? "Game state unavailable" : data.game.phase}
        {data.game.observedAt && ` · State observed ${new Date(data.game.observedAt).toLocaleString()}`}</p>}
    </header>
    {!data.game && <p role="status">No live or upcoming game is available. Previous games remain selectable.</p>}
    {data.teams.map((team) => <section aria-label={`${team.abbreviation} lines`} key={`${data.game?.id}:${team.teamId}`} className={styles.layout}><Entry team={team} games={data.games} /><UpdateRail team={team} /></section>)}
  </section>;
}
