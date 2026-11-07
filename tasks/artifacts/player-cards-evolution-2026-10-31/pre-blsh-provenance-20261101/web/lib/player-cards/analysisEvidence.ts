import type { DisplayProfile } from "../buyLowSellHigh/displayProfile";
import { compareMarketReference, type MarketExpectation, type MarketReference } from "../buyLowSellHigh/market";
import type { AnalysisSnapshot } from "./analysisSnapshot";

export type EvidenceReceipt = { status: "fixture" | "owner-reviewed"; reference: string; snapshotSHA256: string; methodVersion: string; season: number; observedAt: string; strength: string; gameIds: number[]; sourceRows: { sourceId: number; gameId: number }[] };
export type CardEvidence = { status: "unavailable" | "exploratory"; heading: string; lines: string[]; direction: "positive" | "negative" | "level" | "unknown"; receipt: EvidenceReceipt | null; market: string; retained?: { snapshotSHA256: string; reviewReference: string; asOfUTC: string; eventThroughDate: string; dates: string[]; methodVersion: string; profile: DisplayProfile; limits: string[] } };
const hash = (s: string) => /^[0-9a-f]{64}$/.test(s);
const sameIds = (a: number[], b: number[]) => a.length === b.length && new Set(a).size === a.length && [...a].sort((x, y) => x - y).every((id, i) => id === [...b].sort((x, y) => x - y)[i]);

/** Consumes the owner's display mapping. Never recomputes a BLSH score or direction. */
export function cardBlshEvidence(snapshot: AnalysisSnapshot, profile: DisplayProfile | null, receipt: EvidenceReceipt | null): CardEvidence {
  const unavailable = (reason: string): CardEvidence => ({ status: "unavailable", heading: "BLSH evidence unavailable", lines: [reason], direction: "unknown", receipt: null, market: "Market reference unavailable" });
  if (!profile || !receipt) return unavailable("An owner-qualified current method and snapshot receipt has not been supplied.");
  if (snapshot.capture.source !== "synthetic" && receipt.status !== "owner-reviewed") return unavailable("Synthetic BLSH evidence cannot bind to observed results.");
  if (profile.playerId !== snapshot.capture.player.id || receipt.season !== snapshot.capture.season || profile.team !== snapshot.capture.player.team) return unavailable("BLSH player, team or season does not match this card.");
  if (!receipt.reference.trim() || !hash(receipt.snapshotSHA256) || receipt.methodVersion !== "support-conditioned-production-gap-v1" || profile.score.version !== receipt.methodVersion) return unavailable("BLSH snapshot hash, review or method version is unverified.");
  if (receipt.strength !== snapshot.capture.strength || !sameIds(receipt.gameIds, snapshot.recent.gameIds) || !Array.isArray(receipt.sourceRows) || receipt.sourceRows.some(r => !Number.isSafeInteger(r.sourceId) || r.sourceId <= 0 || !Number.isSafeInteger(r.gameId) || r.gameId <= 0) || !sameIds(receipt.sourceRows.map(r => r.sourceId), profile.evidence.window.sourceIds) || !sameIds(receipt.sourceRows.map(r => r.gameId), snapshot.recent.gameIds)) return unavailable("BLSH window, source-row-to-NHL-game mapping or strength does not match the displayed games.");
  if (!Number.isFinite(Date.parse(receipt.observedAt)) || receipt.observedAt !== snapshot.capture.observedAt || !profile.evidence.window.fresh || !profile.coverage.context.current.verified) return unavailable("BLSH source time or current support is stale, incomplete or incompatible.");
  if (profile.claims.forecast || profile.claims.marketValue || profile.claims.trusted || profile.score.calibratedProbability !== null) return unavailable("Research-only BLSH claims do not match the reviewed display contract.");
  if (profile.tracks.some(t => ![t.observed, t.supportConditioned, t.gap].every(Number.isFinite)) || profile.tracks.length !== 3) return unavailable("Player-specific production and support are incomplete.");
  const sign = profile.score.gapSign;
  const direction = sign === "buy_low_evidence" ? "positive" : sign === "sell_high_evidence" ? "negative" : sign === "balanced" ? "level" : "unknown";
  return { status: "exploratory", heading: "BLSH · exploratory support evidence", direction, receipt: JSON.parse(JSON.stringify(receipt)), market: "Market reference unavailable", lines: [
    `${profile.displayName}: ${profile.score.statusLabel}. ${profile.score.gapSignLabel || "Direction unavailable"}.`,
    ...profile.tracks.map(t => `${t.label}: recorded ${t.observed.toFixed(2)}, support-conditioned ${t.supportConditioned.toFixed(2)}, signed gap ${t.gap.toFixed(2)} over ${profile.evidence.window.games} recorded games.`),
    ...profile.context.opportunity.map(o => `${o.label}: ${o.current === null ? "unavailable" : `${o.current.toFixed(2)} ${o.units}`}${o.reasonText ? ` (${o.reasonText})` : ""}.`),
    profile.evidence.tierNote, profile.evidence.reference.ageText, profile.evidence.calibratedProbabilityText,
    ...profile.coverage.notes.map(n => n.text), "Descriptive regression/support evidence; not a qualified forecast, trade price or recommendation. Ownership is not market price.",
  ] };
}

export function cardMarketReference(expected: MarketExpectation | null, reference: MarketReference | null, asOf: string, approvedMaxAgeHours: number | null) {
  if (!expected || approvedMaxAgeHours === null || !Number.isFinite(approvedMaxAgeHours) || approvedMaxAgeHours < 0 || expected.value === null || !Number.isFinite(expected.value) || !Number.isSafeInteger(expected.horizonGames) || expected.horizonGames <= 0) return { status: "unavailable" as const, label: "Market reference unavailable", reason: "Qualified comparable expectation and freshness policy required." };
  return compareMarketReference(expected, reference, { asOf, maxAgeHours: approvedMaxAgeHours });
}

export type TradeAsset = { kind: "player"; playerId: number; name: string } | { kind: "pick"; season: string; round: number | null; description: string };
/** Public context only: no manager, account or private-league identifiers. */
export type TradeObservation = {
  id: string; source: "Yahoo Trade Market"; sourceUrl: string; attribution: string;
  observedAt: string; tradedAt: string | null; give: TradeAsset[]; receive: TradeAsset[];
  context: { scoring: string | null; roster: string | null; leagueSize: number | null };
  sample: "observed" | "synthetic";
};
export type TradeContext = { status: "unavailable" | "observed" | "synthetic"; records: TradeObservation[]; lines: string[] };
const assetKey = (a: TradeAsset) => a.kind === "player" ? `player:${a.playerId}` : `pick:${a.season}:${a.round}:${a.description}`;
const bundleKey = (assets: TradeAsset[]) => assets.map(assetKey).sort().join("|");
const validAsset = (a: TradeAsset) => a.kind === "player" ? Number.isSafeInteger(a.playerId) && a.playerId > 0 && !!a.name.trim() : a.kind === "pick" && !!a.season.trim() && !!a.description.trim() && (a.round === null || Number.isSafeInteger(a.round) && a.round > 0);
export function cardTradeContext(playerId: number, records: readonly TradeObservation[], options: { fixture: boolean; ownerReceipt: string | null; asOf: string }): TradeContext {
  const empty = (why: string): TradeContext => ({ status: "unavailable", records: [], lines: [why, "Market reference unavailable. No trade collection was attempted."] });
  if (!Number.isFinite(Date.parse(options.asOf))) return empty("Trade observation cutoff is invalid.");
  if (!options.fixture && !options.ownerReceipt?.trim()) return empty("Qualified Yahoo observed-trade records and owner review receipt unavailable.");
  const unique = new Map<string, TradeObservation>();
  for (const r of records) {
    if (!r.id || r.source !== "Yahoo Trade Market" || !r.attribution.trim() || !/^https:\/\/(?:[a-z0-9-]+\.)*yahoo\.com\//i.test(r.sourceUrl) || !Number.isFinite(Date.parse(r.observedAt)) || Date.parse(r.observedAt) > Date.parse(options.asOf) || (r.tradedAt !== null && (!Number.isFinite(Date.parse(r.tradedAt)) || Date.parse(r.tradedAt) > Date.parse(r.observedAt))) || r.sample !== (options.fixture ? "synthetic" : "observed") || !r.give.length || !r.receive.length || [...r.give, ...r.receive].some(a => !validAsset(a))) return empty("Trade source, dates, full assets or sample labels could not be verified.");
    const previous = unique.get(r.id);
    if (previous && (bundleKey(previous.give) !== bundleKey(r.give) || bundleKey(previous.receive) !== bundleKey(r.receive) || JSON.stringify(previous.context) !== JSON.stringify(r.context) || previous.tradedAt !== r.tradedAt)) return empty("Conflicting observations share a transaction ID; examples withheld.");
    if (!previous || r.observedAt < previous.observedAt) unique.set(r.id, JSON.parse(JSON.stringify(r)));
  }
  const linked = [...unique.values()].filter(r => [...r.give, ...r.receive].some(a => a.kind === "player" && a.playerId === playerId));
  if (!linked.length) return empty("No qualified trades matched this NHL player ID.");
  return { status: options.fixture ? "synthetic" : "observed", records: linked, lines: [options.fixture ? "Synthetic contract examples; no actual trades asserted." : `${linked.length} deduplicated observed transaction(s). Not a representative market sample.`, "Unknown league, scoring or roster context stays unknown. An observed trade elsewhere is not an offer for your league.", "Full bundles and picks are preserved without pick valuation. No guarantee of fairness, benefit or acceptance."] };
}
export function illustrativeTradeIdeas(context: TradeContext): { label: string; give: TradeAsset[]; receive: TradeAsset[]; caveat: string }[] {
  return context.records.map(r => ({ label: context.status === "synthetic" ? "Synthetic illustrative scenario" : "Illustrative scenario from an observed trade", give: r.give, receive: r.receive, caveat: `Assumes the recorded complete bundles; scoring ${r.context.scoring || "unknown"}, roster ${r.context.roster || "unknown"}. Not a fair-value estimate or an acceptance prediction.` }));
}
export type PreseasonAnchor = { playerId: number; season: number; publishedAt: string; source: string; value: number; unit: string };
export function preseasonAnchorLabel(anchor: PreseasonAnchor | null, playerId: number, season: number): string {
  if (!anchor || anchor.playerId !== playerId || anchor.season !== season || !Number.isFinite(anchor.value) || !Number.isFinite(Date.parse(anchor.publishedAt)) || !anchor.source.trim() || !anchor.unit.trim()) return "Dated preseason anchor unavailable.";
  return `Preseason anchor: ${anchor.value} ${anchor.unit}, season ${anchor.season}, ${anchor.source}, published ${anchor.publishedAt}. Historical anchor only; not current performance, market price or pick value.`;
}
