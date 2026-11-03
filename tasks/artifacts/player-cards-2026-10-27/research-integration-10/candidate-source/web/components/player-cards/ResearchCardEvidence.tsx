import React from "react";
import { blshDiagnostics, RESEARCH_TRACKS, TRACK_LABELS, researchBinding, streakTrackView, researchNumber, words, record, type ResearchHost } from "../../lib/player-cards/researchSnapshot";
export default function ResearchCardEvidence({ card }: { card: ResearchHost }) {
  const snapshot = card.playerResearchSnapshot, binding = researchBinding(card);
  if (!snapshot) return <section aria-label="Research evidence"><p>Streak research unavailable: no manifest-bound snapshot supplied.</p><p>BLSH research unavailable: not evaluated for this card. No historical fixture is substituted.</p></section>;
  if (!binding) return <section aria-label="Research evidence"><p role="alert">Research evidence rejected: player, exact historical date or manifest binding does not match this card.</p></section>;
  const b = snapshot.blshResearch, families = record(record(b.components).families);
  return <section aria-label="Research evidence">
    <h2>{snapshot.fixtureKind === "synthetic_contract" ? "Synthetic contract example" : "Historical development example"} · {snapshot.asOf.eventThroughDate}</h2>
    <p>Research only · production detector unselected · trusted for activation: false. Streak state and BLSH discrepancy answer different questions.</p>
    <h3>Streak research · {words(snapshot.streak.availability)}</h3>
    <p>Saved block5 research z. Value per game is the last recorded game value, not a rolling average. Prior 2022–23 regular-season reference; no cohort fallback.</p>
    {RESEARCH_TRACKS.map(id => { const track = snapshot.streak.tracks[id], row = streakTrackView(track, snapshot.asOf.eventThroughDate); return <details key={id}>
      <summary>{TRACK_LABELS[id]}: {row.state} · {row.reference}</summary>
      <p>Last recorded game value: {row.lastValue} · saved block5 z: {row.z} · observation: {row.observationDate}</p><p>Saved reason: {row.reason}. {row.transition}. Last known flag: {row.lastKnownFlag}.</p>
      <p>First crossing: {row.firstCrossingOn || "Unknown"}; confirmation: {row.confirmedOn || "Unknown"}; exit confirmed: {row.exitConfirmedOn || "Unknown"}; censor: {row.censoredOn || "Unknown"}.</p>
      <p>Window source IDs: {track.signal.windowSourceIds?.join(", ") || "Unavailable"}. Window dates: {track.signal.windowDates?.join(", ") || "Unavailable"}.</p>
    </details>; })}
    <p>A saved “missing outcome” reason can accompany an incomplete reference. It does not by itself diagnose a missing current provider feed. Missing/censored is not zero or normal.</p>
    <h3>BLSH research · {words(b.status)}</h3>
    <p>Saved production P: {researchNumber(b.productionP)} · support-adjusted discrepancy: {researchNumber(b.supportDiscrepancy)}.</p>
    <p>Saved research direction: {b.direction || "Withheld"}; included in saved research list: {b.includedInSavedResearchList ? "yes" : "no"}. {b.reason ? `Reason: ${words(b.reason)}.` : ""} Numeric sign does not create a recommendation or select streak state.</p>
    {blshDiagnostics(snapshot).map(line => <p key={line}>{line}</p>)}
    <details><summary>Saved supporting families</summary>{Object.entries(families).map(([name, value]) => { const family = record(value); return <p key={name}>{words(name)}: {typeof family.status === "string" ? words(family.status) : "unavailable"}; personal comparison: {typeof family.personal_comparison_status === "string" ? words(family.personal_comparison_status) : "unavailable"}.</p>; })}<p>Family facts are versioned history. The separately versioned sealed on-ice context controls its own availability. Low/zero shots do not veto the broad profile.</p></details>
    <h3>Evidence and time</h3><p>Game-date precision only. Source availability, retrieval and issuance time: unknown. Packaging {snapshot.asOf.generatedAtUTC} is not issuance. No current alert, forecast, causal luck or calibrated confidence claim.</p>
    <p>Streak version: {snapshot.streak.version}; BLSH version: {b.version}.</p><p style={{ overflowWrap: "anywhere" }}>Manifest SHA-256: {binding.manifestSha256}<br />Fixture SHA-256: {binding.fixtureSha256}</p>
  </section>;
}
