import { Component, QualificationManifest, Vintage, unavailable } from "./contracts";
import { AdjustedMeans } from "./participation";
import { QualificationEvidence, assessQualification } from "./qualification";

export const RSO_V2_ADAPTER_ENABLED = false as const;
/** Qualification alone cannot activate an RSO consumer; separate owner acceptance remains required. */
export function disabledRsoAdapter(vintage: Vintage, manifest: QualificationManifest | null, evidence: QualificationEvidence[]): Component<AdjustedMeans> {
  const qualification = assessQualification(vintage, manifest, evidence);
  if (qualification.state === "unavailable") return qualification;
  return unavailable("rso_v2_adapter_disabled_pending_owner_acceptance");
}
