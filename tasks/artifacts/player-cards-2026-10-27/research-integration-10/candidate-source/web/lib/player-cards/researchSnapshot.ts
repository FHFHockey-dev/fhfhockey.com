import { RESEARCH_MANIFEST_SHA256, researchExample } from "./researchExamples";
import type { Json, PlayerResearchSnapshotV1, ResearchCardExtension, StreakTrack, Track } from "./researchSnapshot.types";
export type ResearchHost = { player: { id: number; name?: string }; eventThroughDate: string | null } & ResearchCardExtension;
export type ResearchBinding = Readonly<{ file: string; manifestSha256: string; fixtureSha256: string; playerId: number; eventThroughDate: string }>;
const bindings = new WeakMap<PlayerResearchSnapshotV1, ResearchBinding>();
export const RESEARCH_TRACKS: readonly Track[] = ["fantasy_points", "raw_points", "wigo_game_score", "composite"];
export const TRACK_LABELS: Record<Track, string> = { fantasy_points: "Fantasy points", raw_points: "Goals + assists", wigo_game_score: "FHFH WiGO Game Score", composite: "Three-track composite" };
export const record = (value: Json | undefined): { readonly [key: string]: Json } => value && typeof value === "object" && !Array.isArray(value) ? value as { readonly [key: string]: Json } : {};
export const researchNumber = (value: unknown, digits = 2) => typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : "Unavailable";
export const words = (value: string) => value.replace(/_/g, " ");
function freeze<T>(value: T): T { if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
const date = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value + "T00:00:00Z"));

/** Accepts only exact independently reviewed bytes, not arbitrary objects cast to the DTO. */
export async function readResearchFixture(text: string, selection: { file: string; playerId: number; eventThroughDate: string }, manifestSha256: string): Promise<PlayerResearchSnapshotV1> {
  const expected = researchExample(selection.file), bytes = new TextEncoder().encode(text);
  if (!expected || expected.playerId !== selection.playerId || expected.eventThroughDate !== selection.eventThroughDate || manifestSha256 !== RESEARCH_MANIFEST_SHA256 || bytes.length > 128 * 1024) throw new Error("Research manifest/player/date binding is unavailable.");
  const sha = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(n => n.toString(16).padStart(2, "0")).join("");
  if (sha !== expected.sha256) throw new Error("Research fixture hash changed. No evidence was attached.");
  // Narrowing follows the exact-byte allowlist; this is not a general-purpose live schema validator.
  const value = JSON.parse(text) as PlayerResearchSnapshotV1, a = value.asOf, b = value.blshResearch;
  if (value.schemaVersion !== "fhfh.player-research-snapshot.v1" || value.playerId !== expected.playerId || value.fixtureKind !== expected.kind || value.usage.researchOnly !== true || value.usage.productionDetectorSelected !== false || value.usage.trustedForActivation !== false || a.eventThroughDate !== expected.eventThroughDate || !date(a.eventThroughDate) || a.issuedAtUTC !== null || a.sourceAvailableThroughUTC !== null || a.retrievedAtUTC !== null || a.historicalIssuance !== false || a.timePrecision !== "game_date" || value.streak.version !== "blsh-overnight-three-track-v2" || value.streak.researchOption !== "block5" || value.streak.productionAdopted !== false || b.version !== "support-conditioned-production-gap-v1" || b.trustedForActivation !== false || b.confidenceProbability !== null || b.recommendation !== null || b.sourceSnapshotDate !== null && b.sourceSnapshotDate !== a.eventThroughDate) throw new Error("Research versions, dates or research-only flags do not match.");
  for (const id of RESEARCH_TRACKS) {
    const t = value.streak.tracks[id];
    if (!t || t.issuedAtUTC !== null || t.retrospectivePhaseLabelsIncluded !== false || t.reference.requiredRecordedSlots !== 50 || t.reference.cohortFallbackUsed !== false || t.timePrecision !== "game_date") throw new Error("Research track evidence is incomplete.");
  }
  freeze(value); bindings.set(value, freeze({ file: expected.file, playerId: expected.playerId, eventThroughDate: expected.eventThroughDate, manifestSha256, fixtureSha256: sha })); return value;
}
export function researchBinding(card: ResearchHost): ResearchBinding | null {
  const snapshot = card.playerResearchSnapshot, binding = snapshot && bindings.get(snapshot);
  return binding && binding.playerId === card.player.id && binding.eventThroughDate === card.eventThroughDate ? binding : null;
}
/** Optional additive field only: preserves all existing fields and rejects a historical/current mismatch. */
export function withPlayerResearchSnapshot<T extends ResearchHost>(card: T, snapshot: PlayerResearchSnapshotV1): T & ResearchCardExtension {
  const candidate = { ...card, playerResearchSnapshot: snapshot };
  if (!researchBinding(candidate)) throw new Error("Historical research does not match this card's player and exact game-date context.");
  return candidate;
}
export function researchCardKey(card: ResearchHost): string {
  const binding = researchBinding(card); if (!binding) throw new Error("Manifest-bound research evidence is required.");
  return JSON.stringify([card.player, card.eventThroughDate, binding, card.playerResearchSnapshot]);
}
export function streakTrackView(track: StreakTrack, cutoff: string) {
  const t = track.lastTransition, known = t && t.knownOn <= cutoff && t.eventOn <= cutoff ? t : null;
  const episode = track.episode;
  const visibleDate = (value: string | null | undefined) => value && value <= cutoff ? value : null;
  return {
    state: words(track.status), availability: track.availability,
    reference: `${track.reference.observedRecordedSlots}/${track.reference.requiredRecordedSlots} reference slots · ${words(track.reference.status)}`,
    lastValue: researchNumber(track.signal.valuePerGame), z: researchNumber(track.signal.savedZ), reason: track.reason ? words(track.reason) : "No saved exclusion",
    transition: known ? `${words(known.kind)} · known ${known.knownOn}${known.eventOn !== known.knownOn ? ` · event ${known.eventOn}` : ""}` : "No known transition",
    // These are only saved dates knowable at this cutoff. Never relabel confirmation as exiting onset.
    firstCrossingOn: visibleDate(episode?.firstCrossingOn), confirmedOn: visibleDate(episode?.confirmedOn), exitConfirmedOn: visibleDate(episode?.exitConfirmedOn), censoredOn: visibleDate(episode?.censoredOn),
    lastKnownFlag: track.lastKnownFlag || "None", observationDate: track.observation?.gameDate || "Unavailable",
  };
}
export function blshDiagnostics(snapshot: PlayerResearchSnapshotV1): string[] {
  const b = snapshot.blshResearch, c = record(b.components), shared = record(c.sharedOnice), modes = Array.isArray(c.processModes) ? c.processModes : [], estimated = Array.isArray(c.imputedCurrentIndices) ? c.imputedCurrentIndices.length : null;
  const weight = typeof c.personalWeight === "number" ? `${(c.personalWeight * 100).toFixed(1)}%` : "Unavailable";
  const cohort = typeof c.cohortWeight === "number" ? `${(c.cohortWeight * 100).toFixed(1)}%` : "Unavailable";
  return [
    `Personal n ${researchNumber(c.personalHistoryN, 0)} · weight ${weight} · cohort weight ${cohort}`,
    `Process references: ${modes.length ? modes.map(mode => typeof mode === "string" ? words(mode) : "Unavailable").join(" / ") : "Unavailable"}`,
    `Estimated current components: ${estimated === null ? "Unavailable" : estimated} · appearance age: ${researchNumber(c.appearanceAgeDays, 0)} days`,
    `Historical freshness proxy: ${c.freshnessProxy === true ? "present" : c.freshnessProxy === false ? "absent" : "unavailable"} · live freshness unknown`,
    `Sealed on-ice context: ${typeof shared.status === "string" ? words(shared.status) : "unavailable"} · finishing: ${typeof c.finishingState === "string" ? words(c.finishingState) : "unavailable"}`,
    "Weights and measured-process labels are not calibrated confidence.",
  ];
}
