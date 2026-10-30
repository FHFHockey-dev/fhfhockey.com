# RECEIPT-9 — TT-9: Deployment labels MORE ICE / LESS ICE (lane TT, offline)

- **Ticket:** TT-9 from the chef. TJ decided: keep the ice-time-first column rule and relabel the Deployment columns.
- **Not done:** no production reads, no pushes, no deploys.

## Changes

- **Vertical labels:** Deployment's labels are now **MORE ICE** (green) and **LESS ICE** (red), replacing PROMOTIONS / DEMOTIONS, so the label names what decides the column.
- **Column rule:** unchanged. abs(TOI change) ≥ 1:00 → column by the TOI sign; role-only rows follow the line/PP direction.
- **Chips:** the line and PP chips keep their own arrows. For example, A. Carrier sits under MORE ICE with ▼ P1 → P3, and Greene under LESS ICE with ▲ L4 → L3.
- **Badge (my choice, as allowed):** the tile badge **MORE ICE / LESS ICE is dropped** on ice-time tiles, because it only repeated the column label. Role-only tiles **keep PROMOTED / DEMOTED**, because that adds what the column label doesn't say. This also frees room in the chip row.
- **Copy:** code comments and CONTRACT.md (deployment label line and badge note) are updated. Grep finds no remaining "PROMOTIONS" / "DEMOTIONS" in the social-share code or spec.
- **E2E:**
  - The label assertion is now `deployment: MORE ICE (up), LESS ICE (down)`.
  - New badge assertion: ice-time tiles have no badge, and role-only tiles show PROMOTED for ▲ or DEMOTED for ▼.

## Evidence

- `tt9/after/fixture/TT9-OFFLINE-FIXTURE-{png,phone,desktop}-deployment.png`.
- `tt9/after/genuine-run2/TT9-GENUINE-DATA-{png,phone,desktop}-deployment.png`; all four export tokens match the snapshot.

## Checks

| Check | Result |
|---|---|
| E2E full spec, :3110, Monday/Wednesday pins asserted against v2, collision guard on (two passes; see RECEIPT-5) | **34 passed** (33 + 1) |
| Monday (9) / Wednesday (9) PNG pins | **byte-identical to v2** |
| Tuesday pins | deployment changed by design (labels, badges); 01936c4120e27acfaa868185262b564e96ec218f4e48594ea4df097894ffc93b, fe5d9eff8ea48497ef2a8d738dbbed3e30777e6a3c5708e7d375a15b0783b9e3, 4f1bd9426b65a09dc4736db6c6c366171a8b4d44377df24f95319575a9c0a1e3, 8b579de42d5c05721a419b37bb01bee793d97071f3cf6907c563a91e71c0748c |
| Vitest | 231/231 |
| ESLint / full `tsc --noEmit` / CSS pure | exit 0 / **exit 0 after the follow-up fix** / PURE OK |

## Follow-up commit (tsc)

- **What happened:** the first TT-9 commit (`0c9ec95fd`) went in with full tsc at **exit 2**. The new badge assertion read `textContent` as possibly null (TS18047, `e2e/social-share.spec.ts:901`), and my commit script did not gate on tsc.
- **Fix:** the assertion now types the pair as `[string, string | null]` and uses `?? ""` instead of a non-null assertion.
- **After the fix:** full tsc exit 0, eslint exit 0, and the affected E2E test ("Tuesday tiles never collide…", which holds the badge assertion) re-run and passed (`run/e2e-final-20.log`). Nothing else changed.

## Files and sha256

| File | sha256 |
|---|---|
| `web/components/SocialShare/SocialShare.tsx` | `a292f10c031ba6a7115906295d227b18254af80f422e1fda7c9e9b688e6361ae` |
| `web/e2e/social-share.spec.ts` | `6c906242f61a9ca6755e1d8ca88db42a563780ba513a23152db84f6a27393374` |
| `tasks/artifacts/tuesday-trends-2026-10-26/CONTRACT.md` | `aaa9c6bb23c440649ea2ea7640041caf49196a070bb1dcc94b40014a3fc973ac` |
| `tasks/diaries/2026-10-26-claude-tuesday-trends-worker.md` | `904a8398ed40108d5cbd128dd9d6618a1e764b83a831cd4ccf6e6bee2a4bd71c` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/e2e-final-19a.log` | `22b5e79ff9c51585299139d92bc2ba8c49d39ec158962087f245532adb59412e` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/e2e-final-19b.log` | `490db7cbc020873f0a0a4415a9b0472f291bae64f2b3044d177174b605dfc042` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/vitest.log` | `85a351650de4083199155f368e1b280c33151245b6f138b4906afd2d03d1aa98` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/tsc.log` | `cbf7de6a7ab22aa8f3b63eed31368677222a5389d4a0bcaa112a952910051cec` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/eslint.log` | `a6b49f7a0b519016701eccb4efc2de2d77010ed919b35fdad1e3abacbe9dcfd8` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/css-pure-check.log` | `90a2d6370986b7630897e858b77b946afa0a93ed6b13a7a8c0d49b8c05e7d9c6` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/evidence-19/tuesday-cards-pinned.sha256` | `2d43cf4960ab446155d91ea318b18aafdc85145b1b0b361722bdeb5ce7d9dc76` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt9/after/fixture/TT9-OFFLINE-FIXTURE-desktop-deployment.png` | `2b5aade3775bb37746ec3c380459b8f824f6ce406ee9290bd12171bb3139dd59` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt9/after/fixture/TT9-OFFLINE-FIXTURE-phone-deployment.png` | `823e9da9523672b0c4923a87d69272ea02b5fdc8ae118449ed7f07cc504f7b8d` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt9/after/fixture/TT9-OFFLINE-FIXTURE-png-deployment.png` | `30295b193e91bd80b73a238af0e6bdb47634718dd84a0261dfb19db65700d429` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt9/after/genuine-run2/TT9-GENUINE-DATA-desktop-deployment.png` | `dadd72be5394489c54a0696534b6a8a2c49022c66e9e16eb1924f66f5970a5b8` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt9/after/genuine-run2/TT9-GENUINE-DATA-export-tokens.json` | `2c5206ab570e01033775d2bc9523909ede62a570275be369f6720bed4ff0d0e0` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt9/after/genuine-run2/TT9-GENUINE-DATA-phone-deployment.png` | `095d6f0538476f47c6cb73b0e7501ce282c8d9e2a3889f0f265675e257aa5d36` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt9/after/genuine-run2/TT9-GENUINE-DATA-png-deployment.png` | `013d8185c636c431a8cd6712fa92eb68a4e49106181af1a2191bb4d4b2a1fc07` |

Note: `*.log` files are gitignored; their hashes cover the local copies.
