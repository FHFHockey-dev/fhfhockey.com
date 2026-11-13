// Pipeline diagnostics (raw QA source, skipped-row counts, per-game exclusion
// reasons, unsupported-formation leftovers) are for development only and stay
// hidden from fans in production (TJ, 2026-11-12).
export const SHOW_DIAGNOSTICS = process.env.NODE_ENV !== "production";
