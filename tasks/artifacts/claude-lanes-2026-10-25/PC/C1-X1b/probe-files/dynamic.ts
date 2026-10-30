// PROBE (must fail): dynamic import()
export const probe = async () => (await import("../player-cards/evidenceBundle")).validateEvidenceBundle;
