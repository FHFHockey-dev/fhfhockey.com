// PROBE (must fail): namespace import exposes the restricted name
import * as evidence from "../../lib/player-cards/evidenceBundle";
export const probe = evidence.validateEvidenceBundle;
