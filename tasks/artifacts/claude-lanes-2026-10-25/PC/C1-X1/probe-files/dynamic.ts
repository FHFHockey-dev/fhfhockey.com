// PROBE (known limitation, rule does not cover): dynamic import
export const probe = async () => (await import("../player-cards/evidenceBundle")).validateEvidenceBundle;
