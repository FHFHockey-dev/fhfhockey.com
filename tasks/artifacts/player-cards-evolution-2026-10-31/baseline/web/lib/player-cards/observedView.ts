import type { AdaptedCard } from "./adapter";
import type { CardSettings, MetricReading } from "./contracts";

export type ObservedIdentity = { id: number; name: string; team: string; position?: string };
export type ObservedCardView = {
  id: string; source: "local-observed"; evidenceState: "eligible" | "incomplete";
  player: ObservedIdentity; settings: CardSettings; capturedAt: string;
  sample: { gp: number | null; toiSeconds: number | null; firstDate: string | null; lastDate: string | null };
  readings: MetricReading[]; poolComplete: boolean; exportable: boolean;
};

/** Presentation projection only. Server callers supply the trusted validator's result, never raw rows. */
export function projectObservedCard(card: AdaptedCard, identity: ObservedIdentity, state: "eligible" | "incomplete" | "rejected", publicId: string): ObservedCardView | null {
  if (state === "rejected") return null;
  if (card.origin !== "local-observed" || identity.id !== card.selection.playerId) throw new Error("Observed card identity mismatch");
  const readings = card.readings.map(row => ({
    id: row.id, value: row.value, state: row.state, rank: row.rank ? { ...row.rank } : null,
    ...(row.state === "missing" ? { reason: "Metric source or period evidence incomplete" } : row.state === "undefined" ? { reason: row.reason?.includes("Zero denominator") ? "Undefined: zero denominator" : "Undefined for selected period" } : {}),
    ...(!row.rank ? { rankReason: "Rank unavailable: comparison pool incomplete" } : {}),
  }));
  const gp = card.selection.state === "missing" ? null : card.selection.actualGp;
  const atoi = readings.find(row => row.id === "atoi");
  const toiSeconds = gp !== null && atoi?.state === "valid" && atoi.value !== null ? atoi.value * 60 * gp : null;
  return {
    id: publicId, source: "local-observed", evidenceState: state, player: { ...identity },
    settings: { ...card.settings, period: { ...card.settings.period } }, capturedAt: card.capturedAt,
    sample: { gp, toiSeconds, firstDate: card.selection.firstDate, lastDate: card.selection.lastDate }, readings,
    poolComplete: Object.values(card.coverage).every(pool => pool.fullEligiblePopulationVerified),
    exportable: gp !== null && toiSeconds !== null && readings.some(row => row.state === "valid"),
  };
}
