import path from "node:path";
import type { LocalCardInput } from "./adapter";
import type { MetricId } from "./contracts";
import type { EvidenceBundle, EvidenceResult } from "./evidenceBundle";
import { loadAdmittedEvidence, validateAdmittedEvidence } from "./evidenceLoader";

type State = EvidenceResult["state"];
/**
 * Client-safe verdict for page props: states and coded issue enums only. Free-text reasons, receipt ids, paths,
 * member ids, bundle ids, the adapted card, values and ranks never leave the server; a renderer maps codes to fixed copy.
 */
export type EvidenceVerdict = {
  state: State; metrics: Record<MetricId, State>; issueCodes: string[];
  liveActivation: false; premiumActivation: false;
};

/** Issue codes are code-defined kebab-case constants; anything else is dropped rather than shipped. */
const CODE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Server-fixed retained-evidence root. Unreadable or untraced files admit nothing, so the verdict stays incomplete. */
const RETAINED_EVIDENCE_ROOT = path.join(process.cwd(), "lib", "player-cards", "__fixtures__", "retained");

/**
 * Server-only evidence gate for card wiring (getServerSideProps / API routes). It always loads admitted evidence
 * itself through the trusted loader and validates through `validateAdmittedEvidence`; callers cannot pass a root,
 * receipts or an evidence index. `input` and `bundle` must be server-built, never request JSON.
 */
export async function cardEvidenceVerdict(input: LocalCardInput, bundle: EvidenceBundle): Promise<EvidenceVerdict> {
  const evidence = await loadAdmittedEvidence({ root: RETAINED_EVIDENCE_ROOT, origin: bundle.origin });
  const result = validateAdmittedEvidence(input, bundle, evidence);
  return {
    state: result.state,
    metrics: Object.fromEntries(Object.entries(result.metrics).map(([id, metric]) => [id, metric.state])) as EvidenceVerdict["metrics"],
    issueCodes: Array.from(new Set(result.issues.map(issue => issue.code).filter(code => CODE.test(code)))).sort(),
    liveActivation: false, premiumActivation: false,
  };
}

/** The studio's fabricated preview has no receipts: its bundle names the selection and claims nothing. */
export function unclaimedBundle(input: LocalCardInput, playerId: number, id: string): EvidenceBundle {
  const { season, gameType, strength, period, cutoff } = input.settings;
  return { id, origin: input.origin, selection: { playerId, season, gameType, strength, period, cutoff }, history: [], finality: [], definitions: [], populations: [] };
}
