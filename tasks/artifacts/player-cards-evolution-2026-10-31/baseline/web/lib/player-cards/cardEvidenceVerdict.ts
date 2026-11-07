import path from "node:path";
import { createHash } from "node:crypto";
import type { LocalCardInput } from "./adapter";
import type { MetricId } from "./contracts";
import type { EvidenceBundle, EvidenceResult } from "./evidenceBundle";
import { loadAdmittedEvidence, validateAdmittedEvidence } from "./evidenceLoader";
import { mapNstCapture, type CaptureIssue, type NstCapture } from "./nstCapture";
import { METRICS } from "./registry";
import type { AdaptedCard } from "./adapter";
import { projectObservedCard, type ObservedIdentity, type ObservedCardView } from "./observedView";

type State = EvidenceResult["state"];
/**
 * Client-safe verdict for page props: states and coded issue enums only. Free-text reasons, receipt ids, paths,
 * member ids, bundle ids, the adapted card, values and ranks never leave the server; a renderer maps codes to fixed copy.
 */
export type EvidenceVerdict = {
  state: State; metrics: Record<MetricId, State>; issueCodes: string[];
  liveActivation: false; premiumActivation: false;
};

/** What a page may ship to the client: the verdict state alone. Codes and per-metric states stay server-side. */
export type ClientEvidence = Pick<EvidenceVerdict, "state">;
export const clientEvidence = (verdict: EvidenceVerdict): ClientEvidence => ({ state: verdict.state });

/** Issue codes are code-defined kebab-case constants; anything else is dropped rather than shipped. */
const CODE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Server-fixed retained-evidence root. Unreadable or untraced files admit nothing, so the verdict stays incomplete. */
const RETAINED_EVIDENCE_ROOT = path.join(process.cwd(), "lib", "player-cards", "__fixtures__", "retained");

/**
 * Server-only evidence gate for card wiring (getServerSideProps / API routes). It always loads admitted evidence
 * itself through the trusted loader and validates through `validateAdmittedEvidence`; callers cannot pass a root,
 * receipts or an evidence index. `input` and `bundle` must be server-built, never request JSON.
 */
async function validateCardInput(input: LocalCardInput, bundle: EvidenceBundle): Promise<EvidenceResult> {
  const evidence = await loadAdmittedEvidence({ root: RETAINED_EVIDENCE_ROOT, origin: bundle.origin });
  return validateAdmittedEvidence(input, bundle, evidence);
}

function verdictOf(result: EvidenceResult): EvidenceVerdict {
  return {
    state: result.state,
    metrics: Object.fromEntries(Object.entries(result.metrics).map(([id, metric]) => [id, metric.state])) as EvidenceVerdict["metrics"],
    issueCodes: Array.from(new Set(result.issues.map(issue => issue.code).filter(code => CODE.test(code)))).sort(),
    liveActivation: false, premiumActivation: false,
  };
}

export async function cardEvidenceVerdict(input: LocalCardInput, bundle: EvidenceBundle): Promise<EvidenceVerdict> {
  return verdictOf(await validateCardInput(input, bundle));
}

/** Server-internal result; never page props. The existing clientEvidence projection stays state-only. */
export type ObservedCardEvidence = { verdict: EvidenceVerdict; card: AdaptedCard | null; mappingIssues: CaptureIssue[] };

/**
 * Connect supplied NST count captures to reviewed evidence before exposing an observed card.
 * No fetch or alternate evidence root; mapper proof flags are re-derived by the trusted validator.
 * A mapped capture alone cannot qualify values, history, game finality or league rankings.
 */
export async function observedCardEvidence(capture: NstCapture, bundle: EvidenceBundle): Promise<ObservedCardEvidence> {
  const mapped = mapNstCapture(capture);
  if (mapped.state === "rejected" || bundle.origin !== "local-observed") {
    return {
      verdict: { state: "rejected", metrics: Object.fromEntries(METRICS.map(metric => [metric.id, "rejected"])) as EvidenceVerdict["metrics"], issueCodes: [mapped.state === "rejected" ? "capture-mapping-rejected" : "capture-origin-mismatch"], liveActivation: false, premiumActivation: false },
      card: null,
      mappingIssues: [{ group: "both", reason: mapped.state === "rejected" ? mapped.reason : "Observed capture requires an observed evidence bundle" }],
    };
  }
  const result = await validateCardInput(mapped.input, bundle);
  return { verdict: verdictOf(result), card: result.card, mappingIssues: mapped.issues };
}

/** Sanitized public projection. It preserves unknowns and exposes no receipt/path/reason internals. */
export async function observedCardView(capture: NstCapture, bundle: EvidenceBundle, identity: ObservedIdentity): Promise<ObservedCardView | null> {
  const result = await observedCardEvidence(capture, bundle);
  if (!result.card) return null;
  const publicId = `observed-${createHash("sha256").update(JSON.stringify([capture.id, bundle.id, identity.id, capture.capturedAt, result.card.readings])).digest("hex")}`;
  return projectObservedCard(result.card, identity, result.verdict.state, publicId);
}

/** The studio's fabricated preview has no receipts: its bundle names the selection and claims nothing. */
export function unclaimedBundle(input: LocalCardInput, playerId: number, id: string): EvidenceBundle {
  const { season, gameType, strength, period, cutoff } = input.settings;
  return { id, origin: input.origin, selection: { playerId, season, gameType, strength, period, cutoff }, history: [], finality: [], definitions: [], populations: [] };
}
