"use strict";

// ../tasks/artifacts/player-cards-evolution-2026-10-31/qualify-blsh-entry.ts
var import_node_fs2 = require("node:fs");

// lib/buyLowSellHigh/researchSnapshot.server.ts
var import_node_crypto = require("node:crypto");
var import_node_fs = require("node:fs");
var import_node_path = require("node:path");

// lib/buyLowSellHigh/researchSnapshot.ts
var BLSH_CURRENT_SNAPSHOT_VERSION = "fhfh.blsh.current-research-snapshot.v2";
var BLSH_SCORE_VERSION = "support-conditioned-production-gap-v1";
var isRecord = (v) => !!v && typeof v === "object" && !Array.isArray(v);
var finiteOrNull = (v) => v === null || typeof v === "number" && Number.isFinite(v);
var day = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && (/* @__PURE__ */ new Date(`${v}T00:00:00Z`)).toISOString().slice(0, 10) === v;
var requireValue = (ok, reason) => {
  if (!ok) throw new Error(`Invalid BLSH snapshot: ${reason}`);
};
function safeNumbers(value) {
  if (typeof value === "number") requireValue(Number.isFinite(value), "nonfinite number");
  else if (Array.isArray(value)) value.forEach(safeNumbers);
  else if (isRecord(value)) Object.values(value).forEach(safeNumbers);
}
var close = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
var utc = (v) => typeof v === "string" && /(?:Z|[+-]\d{2}:\d{2})$/.test(v) && Number.isFinite(Date.parse(v));
var hash = (v) => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
var currentStates = ["concordant_research_candidate", "conflicting_baseline_and_support", "support_direction_without_baseline_concordance", "balanced_model_estimate", "unavailable"];
function parseCurrentResearchSnapshot(input2) {
  requireValue(isRecord(input2), "object required");
  const s = input2;
  requireValue(s.schemaVersion === BLSH_CURRENT_SNAPSHOT_VERSION && s.scoreVersion === BLSH_SCORE_VERSION, "current version");
  requireValue(s.scope === "current_season_research" && s.seasonId === 20262027 && ["2026-10-26", "2026-10-28"].includes(s.eventThroughDate), "frozen current scope");
  requireValue(s.provisional === true && s.exploratory === true && s.trusted === false && s.productionAdopted === false && s.confidenceProbability === null && s.issuedAtUTC === null, "current research only");
  requireValue(utc(s.asOfUTC) && utc(s.packagedAtUTC) && Date.parse(s.packagedAtUTC) > Date.parse(s.asOfUTC) && s.eventThroughDate <= s.asOfUTC.slice(0, 10), "capture/packaging chronology");
  const policy = s.referencePolicy;
  requireValue(isRecord(policy) && policy.arm === "A_development_reference" && policy.inputs === "official_receipt_overlay" && policy.stale === true && policy.provisional === true && policy.selectedBy === "TJ" && utc(policy.selectedAtUTC), "selected provisional reference");
  requireValue(Date.parse(policy.selectedAtUTC) <= Date.parse(s.packagedAtUTC), "selection before packaging");
  requireValue(typeof policy.label === "string" && typeof s.historyGate === "string" && typeof s.overlay === "string" && Array.isArray(s.limits), "current limitations");
  requireValue(isRecord(s.sourcePins) && Object.keys(s.sourcePins).length > 0 && Object.values(s.sourcePins).every(hash), "source pins");
  requireValue(Array.isArray(s.profiles) && s.profiles.length > 0 && s.profiles.length <= 1e3, "bounded current profiles");
  const ids = /* @__PURE__ */ new Set(), ranks = { BL: /* @__PURE__ */ new Set(), SH: /* @__PURE__ */ new Set() };
  for (const p of s.profiles) {
    requireValue(Number.isSafeInteger(p.playerId) && p.playerId > 0 && !ids.has(p.playerId), "unique current identity");
    ids.add(p.playerId);
    const score = p.score, evidence = p.evidence, w = evidence.window, ref = evidence.reference;
    requireValue(score.version === s.scoreVersion && score.trusted === false && score.calibratedProbability === null && evidence.calibratedProbability === null, "profile research semantics");
    requireValue(isRecord(p.claims) && ["luckIdentified", "marketValue", "forecast", "trusted"].every((k) => p.claims[k] === false) && p.streak === null, "no unsupported claims or streak");
    requireValue(currentStates.includes(score.status) && finiteOrNull(score.value) && finiteOrNull(score.normalizedGap) && finiteOrNull(score.baselineNormalizedGap), "current score state");
    requireValue(typeof w.fresh === "boolean" && w.recordedThroughDate === s.eventThroughDate, "recorded-through freshness anchor");
    for (const member of [w, ref]) {
      requireValue(Array.isArray(member.dates) && Array.isArray(member.sourceIds) && member.dates.length === member.sourceIds.length, "current window membership");
      requireValue(member.dates.every((d, i) => day(d) && d <= s.eventThroughDate && (i === 0 || member.dates[i - 1] <= d)), "current as-of dates");
      requireValue(member.sourceIds.every((n) => Number.isSafeInteger(n) && n > 0) && new Set(member.sourceIds).size === member.sourceIds.length, "current source identities");
    }
    requireValue(!ref.dates.length || w.dates.length && ref.dates.at(-1) < w.dates[0], "current reference strictly before window");
    requireValue(ref.dates.every((d) => d <= "2024-04-18") && ref.seasons.every((n) => n === 20222023 || n === 20232024), "development reference custody");
    for (const weight of [ref.estimatorWeight, ref.cohortEstimatorWeight]) requireValue(weight === null || typeof weight === "number" && weight >= 0 && weight <= 1, "current estimator weight");
    requireValue(Array.isArray(p.tracks), "display tracks");
    if (score.value === null) requireValue(score.status === "unavailable" && score.normalizedGap === null && evidence.tier === null && p.tracks.length === 0 && score.list === null && typeof score.reason === "string", "unavailable stays unavailable");
    else {
      requireValue(score.status !== "unavailable" && evidence.tier !== null && ["measured_process_personal_reference", "provisional_estimated_or_extrapolated"].includes(evidence.tier) && p.tracks.length === 3, "numeric score coverage");
      requireValue(typeof score.normalizedGap === "number" && close(score.value, 100 * score.normalizedGap / (1 + Math.abs(score.normalizedGap))), "saved index transform");
      const labels = /* @__PURE__ */ new Set();
      for (const t of p.tracks) {
        requireValue(!labels.has(t.track), "unique production track");
        labels.add(t.track);
        requireValue([t.observed, t.referenceAtCurrentTOI, t.supportConditioned, t.gap, t.componentSum, t.normalizationMultiplier, t.normalizedGapContribution, t.baselineNormalizedGapContribution].every((n) => typeof n === "number" && Number.isFinite(n)), "finite track values");
        requireValue(Array.isArray(t.components) && t.components.every((c) => typeof c.value === "number" && Number.isFinite(c.value)), "finite components");
        requireValue(close(t.components.reduce((sum, c) => sum + c.value, 0), t.gap) && close(t.componentSum, t.gap) && close(t.supportConditioned - t.observed, t.gap), "additive track components");
        requireValue(close(t.gap * t.normalizationMultiplier, t.normalizedGapContribution), "normalized contribution");
      }
      requireValue(close(p.tracks.reduce((sum, t) => sum + t.normalizedGapContribution, 0), score.normalizedGap), "joint normalized gap");
    }
    if (score.list !== null) {
      const side = score.list;
      requireValue(side === "BL" || side === "SH", "current list side");
      requireValue(score.status === "concordant_research_candidate" && score.value !== null && w.fresh && (side === "BL" ? score.value > 0 : score.value < 0), "current signed fresh list");
      requireValue(Number.isSafeInteger(score.rank) && score.rank > 0 && !ranks[side].has(score.rank), "unique current rank");
      ranks[side].add(score.rank);
    } else requireValue(score.rank === null, "current withheld rank");
    requireValue(p.coverage.notes.every((n) => typeof n.text === "string" && n.text.length > 0 && (n.games === null || ["current_window_slot", "reference_slot"].includes(n.component) && Number.isSafeInteger(n.games) && n.games > 0)), "coverage note units");
    requireValue(Object.values(p.coverage.context).every((c) => typeof c.verified === "boolean" && (c.verified || typeof c.reason === "string" && typeof c.text === "string")), "recorded context reason");
    requireValue(p.context.signals.every((c) => c.scoreInput === false && c.interpretation === "hypothesis"), "context is not a score input");
  }
  for (const side of ["BL", "SH"]) for (let rank = 1; rank <= ranks[side].size; rank++) requireValue(ranks[side].has(rank), "contiguous current ranks");
  const counts = s.counts;
  requireValue(counts.profiles === s.profiles.length && counts.BL === ranks.BL.size && counts.SH === ranks.SH.size && counts.withheld === s.profiles.length - ranks.BL.size - ranks.SH.size && counts.numeric === s.profiles.filter((p) => p.score.value !== null).length && counts.unavailableTier === s.profiles.filter((p) => p.evidence.tier === null).length, "saved population counts");
  safeNumbers(s);
  return s;
}

// lib/buyLowSellHigh/researchSnapshot.server.ts
var CURRENT_SNAPSHOT_SHA256 = "2f380c2539390f6931ec92ab1d0b1d8cced2b55f5f4cefb8c6e88a694909f2c8";
var CURRENT_SNAPSHOT_BYTES = 9559567;
var CURRENT_SNAPSHOT_PATH = (0, import_node_path.join)(process.cwd(), "lib/buyLowSellHigh/research-snapshots/2026-10-28.arm-a-canonical-repaired.v2.json");
var MAX_SNAPSHOT_BYTES = 12 * 1024 * 1024;
var reader = { size: (path) => (0, import_node_fs.statSync)(path).size, read: (path) => Uint8Array.from((0, import_node_fs.readFileSync)(path)) };
function readCurrentBlshSnapshot(source = reader) {
  const path = CURRENT_SNAPSHOT_PATH;
  const size = source.size(path);
  if (size !== CURRENT_SNAPSHOT_BYTES || size > MAX_SNAPSHOT_BYTES) throw new Error("BLSH current snapshot size outside bound");
  const bytes = source.read(path);
  if (bytes.byteLength !== size) throw new Error("BLSH snapshot changed during read");
  if ((0, import_node_crypto.createHash)("sha256").update(bytes).digest("hex") !== CURRENT_SNAPSHOT_SHA256) throw new Error("BLSH immutable snapshot hash mismatch");
  return parseCurrentResearchSnapshot(JSON.parse(Buffer.from(bytes).toString("utf8")));
}

// lib/player-cards/retainedBlsh.ts
var RETAINED_BLSH_SHA256 = "2f380c2539390f6931ec92ab1d0b1d8cced2b55f5f4cefb8c6e88a694909f2c8";
function retainedBlshEvidence(player, season, input2) {
  const p = input2.profile, s = input2.metadata;
  const unavailable = (reason) => ({ status: "unavailable", heading: "Retained BLSH evidence unavailable", direction: "unknown", lines: [reason], receipt: null, market: "Market reference unavailable" });
  if (input2.snapshotSHA256 !== RETAINED_BLSH_SHA256 || !input2.reviewReference.trim() || s.scoreVersion !== "support-conditioned-production-gap-v1" || p.score.version !== s.scoreVersion || s.schemaVersion !== "fhfh.blsh.current-research-snapshot.v2") return unavailable("Saved snapshot or reviewed method does not match the frozen local handoff.");
  if (p.playerId !== player.id || p.team !== player.team || s.seasonId !== season) return unavailable("Saved BLSH player, team or season does not match the selected player.");
  if (!s.provisional || !s.exploratory || s.productionAdopted || s.trusted || s.confidenceProbability !== null || s.issuedAtUTC !== null || p.claims.forecast || p.claims.marketValue || p.claims.trusted || p.score.calibratedProbability !== null) return unavailable("Saved research flags cannot be promoted to forecast or market claims.");
  const w = p.evidence.window, ref = p.evidence.reference;
  if (!Number.isFinite(Date.parse(s.asOfUTC)) || !Number.isSafeInteger(w.games) || w.games < 1 || w.dates.length !== w.games || w.sourceIds.length !== w.games || new Set(w.sourceIds).size !== w.games || w.dates.some((d) => !/^\d{4}-\d{2}-\d{2}$/.test(d) || d > s.eventThroughDate) || p.tracks.length !== 3 || p.tracks.some((t) => ![t.observed, t.supportConditioned, t.gap].every(Number.isFinite))) return unavailable("Saved research window or production/support values are unavailable.");
  const direction = p.score.gapSign === "buy_low_evidence" ? "positive" : p.score.gapSign === "sell_high_evidence" ? "negative" : p.score.gapSign === "balanced" ? "level" : "unknown";
  const uniqueNotes = [...new Set(p.coverage.notes.map((n) => n.text))];
  return { status: "exploratory", heading: "BLSH \xB7 retained provisional research", direction, receipt: null, market: "Market reference unavailable", retained: { snapshotSHA256: input2.snapshotSHA256, reviewReference: input2.reviewReference, asOfUTC: s.asOfUTC, eventThroughDate: s.eventThroughDate, dates: [...w.dates], methodVersion: s.scoreVersion, profile: JSON.parse(JSON.stringify(p)), limits: [...s.limits] }, lines: [
    `Separate saved window: ${w.dates[0]} to ${w.dates.at(-1)}; ${w.games} appearances, ${w.minutes ?? "unknown"} minutes. NHL controls do not change this evidence window.`,
    `${p.score.statusLabel}; ${direction} support gap.`,
    ...p.tracks.map((t) => `${t.label}: recorded ${t.observed.toFixed(2)}; support-conditioned ${t.supportConditioned.toFixed(2)}; gap ${t.gap.toFixed(2)} (window totals).`),
    `Opportunity: ${p.context.opportunity.map((o) => `${o.label} ${o.current === null ? "unavailable" : o.current.toFixed(2)} ${o.units}`).join("; ")}.`,
    `Reference: ${ref.personalGames} games; age ${ref.ageDays ?? "unknown"} days; stale development history. ${p.evidence.tierNote}.`,
    `Limits: ${uniqueNotes.join("; ")}.`,
    "Retrospective support evidence; no calibrated confidence, forecast, market price or trade recommendation."
  ] };
}

// ../tasks/artifacts/player-cards-evolution-2026-10-31/qualify-blsh-entry.ts
var { profiles, ...metadata } = readCurrentBlshSnapshot();
var profile = profiles.find((p) => p.playerId === 8476453);
var input = { profile, metadata, snapshotSHA256: CURRENT_SNAPSHOT_SHA256, reviewReference: "tasks/artifacts/blsh-snapshot-coordination-2026-10-29/INSTALLATION-AND-NEXT-SLICE.md; portable-install-01/INSTALLATION-RECEIPT.json" };
var result = retainedBlshEvidence({ id: 8476453, team: "TBL" }, 20262027, input);
if (result.status !== "exploratory") throw new Error(result.lines.join(" "));
(0, import_node_fs2.writeFileSync)("../tasks/artifacts/player-cards-evolution-2026-10-31/retained-blsh-input.json", JSON.stringify(input, null, 2) + "\n");
(0, import_node_fs2.writeFileSync)("../tasks/artifacts/player-cards-evolution-2026-10-31/BLSH-QUALIFICATION.json", JSON.stringify({ state: "verified_retained_research_only", snapshotSHA256: CURRENT_SNAPSHOT_SHA256, profiles: profiles.length, season: metadata.seasonId, asOfUTC: metadata.asOfUTC, through: metadata.eventThroughDate, sourceRowsAreNotNhlGameIds: profile.evidence.window.sourceIds, playerId: profile.playerId, team: profile.team, window: profile.evidence.window, tracks: profile.tracks.map((t) => ({ label: t.label, observed: t.observed, supportConditioned: t.supportConditioned, gap: t.gap })), currentBinding: false, reason: "Separate source window/cutoff; source-row to NHL-game mapping absent. Retrospective research, not current advice." }, null, 2) + "\n");
console.log("Owner reader hash/size/parser and retained card mapping passed; no provider calls.");
