/** Client-safe: imports nothing from the evidence modules. Mirrors `EvidenceVerdict["state"]`. */
type VerdictState = "eligible" | "incomplete" | "rejected";
/** Who is showing the verdict: the studio's fabricated preview, or a card checked against a real evidence bundle. */
export type EvidenceContext = "fabricated-preview" | "evidence-bundle";

const TITLE: Record<VerdictState, string> = {
  eligible: "Evidence check: admitted evidence matches",
  incomplete: "Evidence check: incomplete",
  rejected: "Evidence check: rejected",
};
const DETAIL: Record<EvidenceContext, Record<VerdictState, string>> = {
  "fabricated-preview": {
    eligible: "Fabricated preview; every claim matches admitted evidence. Ranks are illustrative.",
    incomplete: "Fabricated preview, no admitted evidence. Ranks are illustrative.",
    rejected: "Fabricated preview; the evidence did not pass validation. Ranks are illustrative.",
  },
  "evidence-bundle": {
    eligible: "Every claim matches reviewed, admitted evidence. Live and premium stay off.",
    incomplete: "Not all evidence is admitted. Ranks without admitted evidence are withheld.",
    rejected: "The evidence did not pass validation. Ranks are withheld.",
  },
};
const own = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);

/**
 * Fixed copy for an evidence status line. Only the verdict state and the caller's explicit context select it; codes
 * and reasons are never shown. An unknown state reads as rejected; an unknown context gets the neutral bundle wording.
 */
export function evidenceStatusCopy(verdict: { state: VerdictState }, context: EvidenceContext) {
  const state: VerdictState = own(TITLE, verdict.state) ? verdict.state : "rejected";
  return { title: TITLE[state], detail: (own(DETAIL, context) ? DETAIL[context] : DETAIL["evidence-bundle"])[state] };
}
