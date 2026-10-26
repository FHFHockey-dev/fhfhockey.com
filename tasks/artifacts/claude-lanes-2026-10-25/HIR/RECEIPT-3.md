# HIR — RECEIPT-3: C7 R20 findings H1–H3

Lane HIR, Claude, 2026-10-25, 18:28–18:33Z (25-minute box). Base: HEAD `1b5c36024`. At the start, the leased files matched RECEIPT-2 (committed in `48809914a`): helper d24e232e…, test 9e4701a2…, alert 4192db6c…, alert test 4e329483….
No Git writes, no GIT_DIR, synthetic fixtures only. No production, provider or DB calls. No pushes. The parent `RosterScheduleOptimizer.tsx` is unchanged (cc131437… = HEAD).

## Fixes
- **H1: maximum assignment.** `healthyReserves()` no longer ranks by direct-spot gain and only then tries swaps for whoever is left. It lists each flagged player's options: the open spot, if any, plus every swap partner Yahoo lists for his slot. A brute-force search then picks the assignment that maximises, in order:
  1. the number of players activated;
  2. projected points, with unknown counted as 0;
  3. active games.

  Each open spot and each partner is used at most once. The search size is the product of (options + 1) per flagged player, which is only a handful of reserve slots in practice. C7's counter-case is now the regression test "activates as many players as the spots and swap partners allow before maximising gain". There, f takes a swap with e (+10) and d takes the open spot (+6), so both are activated. The old greedy code activated only f.
- **H2: tie rule, documented and tested.** On equal scores the search keeps the first assignment it finds. That enumeration runs in roster order, trying the spot, then swaps by gain, then none, so earlier roster players win ties. The listing uses a stable sort (gain, with unknown and then unactivated last), so ties also list in roster order. The code comments say this, and the new test "breaks ties by roster order" covers both roster orders. It passes on HEAD as well: it pins behaviour that was already deterministic but untested.
- **H3: no "best" for unknown gains.** When any activated player's gain is unknown (points and games both null), the alert says "Can be activated: Fresh Legs (+10 pts) and Third Man." For all-known gains it keeps "Only one can be activated: best is …" and "Only k … best are …". The alert test now checks the unknown wording, the absence of "best", and the k=2 known wording. The "no label" checks are case-insensitive.

## Changed paths (final sha256)
| Path | sha256 |
|---|---|
| web/lib/rosterScheduleOptimizer/healthyReserves.ts | 715b7866ef2aab11061ad2d4538bcd832d8b1f256c3b19002f5409699fada530 |
| web/lib/rosterScheduleOptimizer/healthyReserves.test.ts | b978423ac718c74fc128d6660207edd5a739c851500eb22e1dc4f7a5c3c32c08 |
| web/components/RosterScheduleOptimizer/HealthyReserveAlert.tsx | 61e95877630e07c53de691203d1e6f6708128c555d47706406e283c88396f12e |
| web/components/RosterScheduleOptimizer/HealthyReserveAlert.test.tsx | 40ba10d366db41ef47dd5b7a2c37aa85e163c6a76fe7a256d1b37285568cd2f9 |

Patch vs HEAD: `hir-3.patch` (sha256 225f21714854982db078eabd69690c31730e059f79365b4df9aea7368a85076a), 4 files, +62/−25.
`web/next-env.d.ts` is still another lane's change. Leave it out.

## Checks (all run locally)
- **Original failures** (`receipt3-baseline-failures.txt`): run against the HEAD helper and alert, the H1 counter-case and the H3 wording test fail. The other 16 tests pass, including H2, as expected. The new versions were then restored and confirmed byte-identical.
- **Under `/private/tmp/fhfh-heavy.lock`** (mkdir with an OWNER file; I waited and never stole it; my trap released it at 18:32:14, and C1 took it at 18:32:15):
  - Vitest on healthyReserves (14), alert (4), lineupGaps (10) and the parent `RosterScheduleOptimizer.points.test.tsx` (13): **41/41 passed.**
  - Scoped tsc over the 4 files plus the parent: **exit 0.**
  - Whole-project `npm run typecheck`: **exit 0, 0 errors.**
  - eslint on the 4 files: **exit 0, no output.**
- No browser or E2E run.
