import type { DisplayProfile, DisplaySnapshot } from "../buyLowSellHigh/displayProfile";
import type { CardEvidence, RetainedBlshSourceMap } from "./analysisEvidence";

/** Frozen local research handoff, not live input admission or a scoring implementation. */
export const RETAINED_BLSH_SHA256 = "2f380c2539390f6931ec92ab1d0b1d8cced2b55f5f4cefb8c6e88a694909f2c8";
export const RETAINED_BLSH_SIDECAR_SHA256 = "0b98ebc0fa2bbf0554b781d6c7548b820c37768b4868d11784ca837dad070d57";
export const RETAINED_BLSH_PROVENANCE_REVIEW_SHA256 = "54fbf0418908263ce5a0ed3e2b4812c78d70d152aacc818df0568567aa265701";
export type RetainedBlshInput = { profile: DisplayProfile; metadata: Omit<DisplaySnapshot, "profiles">; snapshotSHA256: string; reviewReference: string; provenance?: RetainedBlshSourceMap };
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
      message: `${m.rows.length} recorded source rows mapped. ${m.review ? "Independently reviewed for dated stale research only." : "Independent sidecar review pending."} Capture ${age > m.maxCaptureAgeHours ? "stale" : "within the original age budget only"} at sidecar build (${age.toFixed(1)} hours; ${m.maxCaptureAgeHours}-hour budget). Finality evidence for ${m.rows.filter(r => r.finalityEstablished).length}/${m.rows.length} rows. This mapping does not admit current binding or advanced metrics.`,
    } : { state: "unavailable", currentBinding: false, captureStale: null, sourceMap: null, message: "Source mapping unavailable: sidecar identity, bytes reference, window, time or review status does not match. Previously qualified retained research remains separate." };
  }
  return { status: "exploratory", heading: "BLSH · retained provisional research", direction, receipt: null, market: "Market reference unavailable", retained: { snapshotSHA256: input.snapshotSHA256, reviewReference: input.reviewReference, asOfUTC: s.asOfUTC, eventThroughDate: s.eventThroughDate, dates: [...w.dates], methodVersion: s.scoreVersion, profile: JSON.parse(JSON.stringify(p)), limits: [...s.limits], provenance }, lines: [
    `Separate saved window: ${w.dates[0]} to ${w.dates.at(-1)}; ${w.games} recorded game rows, ${w.minutes ?? "unknown"} minutes. NHL controls do not change this evidence window.`,
    `${p.score.statusLabel}; ${direction} support gap.`,
    ...p.tracks.map(t => `${t.label}: recorded ${t.observed.toFixed(2)}; support-conditioned ${t.supportConditioned.toFixed(2)}; gap ${t.gap.toFixed(2)} (window totals).`),
    `Opportunity: ${p.context.opportunity.map(o => `${o.label} ${o.current === null ? "unavailable" : o.current.toFixed(2)} ${o.units}`).join("; ")}.`,
    `Reference: ${ref.personalGames} games; age ${ref.ageDays ?? "unknown"} days; stale development history. ${p.evidence.tierNote}.`,
    `Limits: ${uniqueNotes.join("; ")}.`,
    "Retrospective support evidence; no calibrated confidence, forecast, market price or trade recommendation.",
  ] };
}
