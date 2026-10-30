// PROBE (must pass): unrelated dynamic import and require with similar names
export const a = () => import("../player-cards/evidenceLoader");
export const b = () => import("./myevidenceBundleNotes");
// eslint-disable-next-line @typescript-eslint/no-require-imports
export const c = require("node:path");
