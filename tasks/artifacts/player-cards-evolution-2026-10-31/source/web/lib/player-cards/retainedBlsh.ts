import type { DisplayProfile, DisplaySnapshot } from "../buyLowSellHigh/displayProfile";
import type { BoxCount, BoxMeasurement, CardEvidence, RetainedBlshBoxes, RetainedBlshSourceMap, RetainedBoxEvidence } from "./analysisEvidence";

/** Frozen local research handoff, not live input admission or a scoring implementation. */
export const RETAINED_BLSH_SHA256 = "2f380c2539390f6931ec92ab1d0b1d8cced2b55f5f4cefb8c6e88a694909f2c8";
export const RETAINED_BLSH_SIDECAR_SHA256 = "0b98ebc0fa2bbf0554b781d6c7548b820c37768b4868d11784ca837dad070d57";
export const RETAINED_BLSH_PROVENANCE_REVIEW_SHA256 = "54fbf0418908263ce5a0ed3e2b4812c78d70d152aacc818df0568567aa265701";
export const RETAINED_BLSH_BOX_PINS = {
  rows: "314a48ef45dbad11b48192bdbada730ccc82fb355895e2dde56b484ece0a6d36",
  boxes: "b83fc6bff7bd470bb245f1053a489aeebab6b17f1f734a2ed18d5753f715447f",
  receipt: "e51173a80e5f0f55e45abf7e914b127b2c8d0cf6f7543a38aa18a9df4f4190a0",
  review: "166b65ff7be1a16883d2546c4a1a03b54f286963324e494b1ebba0a41aeb2ce9",
} as const;
export type RetainedBlshInput = { profile: DisplayProfile; metadata: Omit<DisplaySnapshot, "profiles">; snapshotSHA256: string; reviewReference: string; provenance?: RetainedBlshSourceMap; currentBoxes?: RetainedBlshBoxes };
const boxCounts: Record<BoxCount, string> = { goals: "G", assists: "A", shots: "SOG", hits: "HIT", blocked_shots: "BLK" };
const countKeys = Object.keys(boxCounts) as BoxCount[];
const count = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
const hash = (v: string) => /^[a-f0-9]{64}$/.test(v);
const compared = (v: BoxMeasurement | null | undefined): v is BoxMeasurement => !!v && count(v.wgo) && count(v.official) && v.state === (v.wgo === v.official ? "match" : "mismatch");

function retainedBoxEvidence(input: RetainedBlshInput, provenance: NonNullable<CardEvidence["retained"]>["provenance"]): RetainedBoxEvidence | undefined {
  const b = input.currentBoxes;
  if (!b) return undefined;
  const unavailable = (): RetainedBoxEvidence => ({ state: "unavailable", currentBinding: false, evidence: null, summary: "Box comparison unavailable", lines: ["Comparison receipt, identity, window, dates or field states do not match. Saved research values remain unchanged."] });
  const map = provenance?.sourceMap;
  if (provenance?.state !== "reviewed-retained-only" || !map || b.version !== "fhfh.card-retained-box-comparison.v1" || b.rowsSHA256 !== RETAINED_BLSH_BOX_PINS.rows || b.boxEvidenceSHA256 !== RETAINED_BLSH_BOX_PINS.boxes || b.receiptSHA256 !== RETAINED_BLSH_BOX_PINS.receipt || b.sourceSidecarSHA256 !== map.sidecarSHA256 || b.snapshotSHA256 !== input.snapshotSHA256 || b.wgoCapturedAt !== input.metadata.asOfUTC || b.review?.sha256 !== RETAINED_BLSH_BOX_PINS.review || !b.review.reference.trim() || b.review.scope !== "dated-source-comparison-only" || !Array.isArray(b.rows) || b.rows.length !== map.rows.length) return unavailable();
  const valid = b.rows.every((r, i) => {
    const m = map.rows[i];
    if (r.sourceId !== m.sourceId || r.playerId !== m.playerId || r.gameId !== m.gameId || r.date !== m.date || r.wgoTeam !== m.team || !hash(r.sourceRowSHA256) || !Array.isArray(r.reasons) || !r.reasons.every(t => typeof t === "string")) return false;
    if (r.gameFinality === "unknown") return r.state === "held" && r.appearance === "unknown" && r.team === "unknown" && r.TOI === null && !!r.counts && Object.keys(r.counts).length === 0 && r.PPP === null && r.evidenceGameId === null && r.box === null;
    if (r.gameFinality !== "final" || r.appearance !== "positive_official_TOI" || r.team !== "match" || r.officialTeam !== r.wgoTeam || !count(r.officialTeamId) || r.officialTeamId <= 0 || r.evidenceGameId !== r.gameId || !compared(r.TOI) || r.TOI.wgo <= 0 || r.TOI.official <= 0 || r.state !== (r.TOI.state === "match" ? "identity_team_exposure_qualified" : "held")) return false;
    if (!r.counts || Object.keys(r.counts).length !== countKeys.length || !countKeys.every(k => compared(r.counts[k]))) return false;
    const pp = r.PPP;
    if (!pp || (pp.state === "unknown_PP_assists_not_supplied" ? !count(pp.wgo) || pp.official !== null || r.counts.assists!.official === 0 : !compared(pp) || r.counts.assists!.official !== 0)) return false;
    const box = r.box, at = Date.parse(box?.retrievedAtUTC || "");
    return !!box && box.url === `https://api-web.nhle.com/v1/gamecenter/${r.gameId}/boxscore` && hash(box.bodySHA256) && hash(box.receiptSHA256) && box.originalPublicationUTC === null && Number.isFinite(at) && at <= Date.parse(b.wgoCapturedAt);
  });
  if (!valid) return unavailable();
  const covered = b.rows.filter(r => r.gameFinality === "final");
  const differs = covered.filter(r => r.TOI!.state === "mismatch" || countKeys.some(k => r.counts[k]!.state === "mismatch"));
  const fields = [...(differs.some(r => r.TOI!.state === "mismatch") ? ["TOI"] : []), ...countKeys.filter(k => differs.some(r => r.counts[k]!.state === "mismatch")).map(k => boxCounts[k])];
  const ppUnknown = covered.filter(r => r.PPP?.state === "unknown_PP_assists_not_supplied").length;
  const summary = `Box TOI + 5 counts: ${covered.length - differs.length} match / ${differs.length} differ / ${b.rows.length - covered.length} unknown${fields.length ? ` · ${fields.join("/")} differ` : ppUnknown ? ` · PPP ${ppUnknown} unknown` : ""}`;
  const measurement = (label: string, v: BoxMeasurement) => `${label} ${v.state === "mismatch" ? "differs" : "matches"}: WGO ${v.wgo}, box ${v.official}`;
  return { state: "reviewed-comparison-only", currentBinding: false, summary, evidence: JSON.parse(JSON.stringify(b)), lines: [
    `${covered.length}/${b.rows.length} rows have later-attached final-game/player/team box evidence. Match covers TOI plus G/A/SOG/HIT/BLK only; exposure qualification alone does not certify counts.`,
    `PPP: ${covered.length - ppUnknown} compared, ${ppUnknown} unknown without PP assists, ${b.rows.length - covered.length} without a box. Missing boxes are not DNP or zero.`,
    "These are dated source comparisons, not repairs or a verdict on the later capture. Saved research scores and values are unchanged; no current or advanced-metric admission. Original publication/revision time remains unknown.",
    ...b.rows.map(r => r.box ? `${r.date} · game ${r.gameId} · source row ${r.sourceId}: ${r.state === "identity_team_exposure_qualified" ? "identity, team and exposure match; counts checked separately" : "identity and team match; exposure differs"}. WGO captured ${b.wgoCapturedAt}; box captured ${r.box.retrievedAtUTC}. ${measurement("TOI seconds", r.TOI!)}; ${countKeys.map(k => measurement(boxCounts[k], r.counts[k]!)).join("; ")}; ${r.PPP!.state === "unknown_PP_assists_not_supplied" ? `PPP unknown: WGO ${r.PPP!.wgo}, box PP assists unavailable` : measurement("PPP", r.PPP!)}.` : `${r.date} · game ${r.gameId} · source row ${r.sourceId}: no pinned box in the reviewed bundle; finality, appearance, team and fields unknown.`),
  ] };
}
export function retainedBlshEvidence(player: { id: number; team: string }, season: number, input: RetainedBlshInput): CardEvidence {
  const p = input.profile, s = input.metadata;
  const unavailable = (reason: string): CardEvidence => ({ status: "unavailable", heading: "Retained BLSH evidence unavailable", direction: "unknown", lines: [reason], receipt: null, market: "Market reference unavailable" });
  if (input.snapshotSHA256 !== RETAINED_BLSH_SHA256 || !input.reviewReference.trim() || s.scoreVersion !== "support-conditioned-production-gap-v1" || p.score.version !== s.scoreVersion || s.schemaVersion !== "fhfh.blsh.current-research-snapshot.v2") return unavailable("Saved snapshot or reviewed method does not match the frozen local handoff.");
  if (p.playerId !== player.id || p.team !== player.team || s.seasonId !== season) return unavailable("Saved BLSH player, team or season does not match the selected player.");
  if (!s.provisional || !s.exploratory || s.productionAdopted || s.trusted || s.confidenceProbability !== null || s.issuedAtUTC !== null || p.claims.forecast || p.claims.marketValue || p.claims.trusted || p.score.calibratedProbability !== null) return unavailable("Saved research flags cannot be promoted to forecast or market claims.");
  const w = p.evidence.window, ref = p.evidence.reference;
  if (!Number.isFinite(Date.parse(s.asOfUTC)) || !Number.isSafeInteger(w.games) || w.games < 1 || w.dates.length !== w.games || w.sourceIds.length !== w.games || new Set(w.sourceIds).size !== w.games || w.dates.some(d => !/^\d{4}-\d{2}-\d{2}$/.test(d) || d > s.eventThroughDate) || p.tracks.length !== 3 || p.tracks.some(t => ![t.observed, t.supportConditioned, t.gap].every(Number.isFinite))) return unavailable("Saved research window or production/support values are unavailable.");
  const direction = p.score.gapSign === "buy_low_evidence" ? "positive" : p.score.gapSign === "sell_high_evidence" ? "negative" : p.score.gapSign === "balanced" ? "level" : "unknown";
  const uniqueNotes = [...new Set(p.coverage.notes.map(n => n.text))];
  let provenance: NonNullable<CardEvidence["retained"]>["provenance"];
  if (input.provenance) {
    const m = input.provenance, age = (Date.parse(m.generatedAtUTC) - Date.parse(m.asOfUTC)) / 3_600_000;
    const valid = m.version === "fhfh.blsh.player-card-research-provenance.v1" && m.sidecarSHA256 === RETAINED_BLSH_SIDECAR_SHA256 && m.snapshotSHA256 === input.snapshotSHA256 && m.independentReviewPending === true
      && m.playerId === p.playerId && m.team === p.team && m.season === season && m.asOfUTC === s.asOfUTC && m.eventThroughDate === s.eventThroughDate
      && (!m.review || m.review.scope === "dated-stale-research-only" && !!m.review.reference.trim() && m.review.sha256 === RETAINED_BLSH_PROVENANCE_REVIEW_SHA256 && m.review.sidecarSHA256 === m.sidecarSHA256)
      && Number.isFinite(age) && age >= 0 && m.maxCaptureAgeHours === 24 && Array.isArray(m.limitations) && m.limitations.every(t => typeof t === "string")
      && Array.isArray(m.rows) && m.rows.length === w.games && new Set(m.rows.map(r => r.sourceId)).size === w.games && new Set(m.rows.map(r => r.gameId)).size === w.games
      && m.rows.every((r, i) => Number.isSafeInteger(r.sourceId) && r.sourceId > 0 && Number.isSafeInteger(r.gameId) && r.gameId > 0 && r.sourceId === w.sourceIds[i] && r.date === w.dates[i] && r.playerId === p.playerId && r.season === season && !!r.team && r.regularSeasonCalendarMatched === true && typeof r.finalityEstablished === "boolean");
    provenance = valid ? {
      state: m.review ? "reviewed-retained-only" : "pending-review", currentBinding: false, captureStale: age > m.maxCaptureAgeHours, sourceMap: JSON.parse(JSON.stringify(m)),
      message: `${m.rows.length} recorded source rows mapped. ${m.review ? "Independently reviewed for dated stale research only." : "Independent sidecar review pending."} Capture ${age > m.maxCaptureAgeHours ? "stale" : "within the original age budget only"} at sidecar build (${age.toFixed(1)} hours; ${m.maxCaptureAgeHours}-hour budget). Finality evidence for ${m.rows.filter(r => r.finalityEstablished).length}/${m.rows.length} rows in this original sidecar. This mapping does not admit current binding or advanced metrics.`,
    } : { state: "unavailable", currentBinding: false, captureStale: null, sourceMap: null, message: "Source mapping unavailable: sidecar identity, bytes reference, window, time or review status does not match. Previously qualified retained research remains separate." };
  }
  return { status: "exploratory", heading: "BLSH · retained provisional research", direction, receipt: null, market: "Market reference unavailable", retained: { snapshotSHA256: input.snapshotSHA256, reviewReference: input.reviewReference, asOfUTC: s.asOfUTC, eventThroughDate: s.eventThroughDate, dates: [...w.dates], methodVersion: s.scoreVersion, profile: JSON.parse(JSON.stringify(p)), limits: [...s.limits], provenance, currentBoxes: retainedBoxEvidence(input, provenance) }, lines: [
    `Separate saved window: ${w.dates[0]} to ${w.dates.at(-1)}; ${w.games} recorded game rows, ${w.minutes ?? "unknown"} minutes. NHL controls do not change this evidence window.`,
    `${p.score.statusLabel}; ${direction} support gap.`,
    ...p.tracks.map(t => `${t.label}: recorded ${t.observed.toFixed(2)}; support-conditioned ${t.supportConditioned.toFixed(2)}; gap ${t.gap.toFixed(2)} (window totals).`),
    `Opportunity: ${p.context.opportunity.map(o => `${o.label} ${o.current === null ? "unavailable" : o.current.toFixed(2)} ${o.units}`).join("; ")}.`,
    `Reference: ${ref.personalGames} games; age ${ref.ageDays ?? "unknown"} days; stale development history. ${p.evidence.tierNote}.`,
    `Limits: ${uniqueNotes.join("; ")}.`,
    "Retrospective support evidence; no calibrated confidence, forecast, market price or trade recommendation.",
  ] };
}
