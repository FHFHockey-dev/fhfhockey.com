// PROBE (must fail): dynamic import() through tsconfig alias
export const probe = () => import("lib/player-cards/evidenceBundle");
