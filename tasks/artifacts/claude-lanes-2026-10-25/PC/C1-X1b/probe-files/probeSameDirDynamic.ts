// PROBE (must fail): same-directory dynamic import with extension
export const probe = () => import("./evidenceBundle.ts");
