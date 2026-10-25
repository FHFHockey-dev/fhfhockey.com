/** Client-safe: imports nothing from the evidence modules. Mirrors `EvidenceVerdict["state"]`. */
type VerdictState = "eligible" | "incomplete" | "rejected";

/** Fixed copy for the studio's evidence status line. Only the verdict state selects it; no codes or reasons are shown. */
const COPY: Record<VerdictState, { title: string; detail: string }> = {
  eligible: { title: "Evidence check: admitted evidence matches", detail: "Every claim matches reviewed, admitted evidence. Live and premium stay off." },
  incomplete: { title: "Evidence check: incomplete", detail: "Fabricated preview, no admitted evidence. Ranks are illustrative." },
  rejected: { title: "Evidence check: rejected", detail: "The evidence did not pass validation. Ranks are illustrative." },
};

export function evidenceStatusCopy(verdict: { state: VerdictState }) {
  return COPY[verdict.state] ?? COPY.rejected;
}
