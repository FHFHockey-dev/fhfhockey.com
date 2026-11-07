# HIR — RECEIPT-2: TJ's healthy-reserve rules 1 and 2

Lane HIR, Claude, 2026-10-25, 17:41–17:47Z (30-minute box). Base: HEAD `33d99b377`, which includes `9e861bfdc`. Leased files were clean at the start and matched RECEIPT.md: healthyReserves.ts 91b99377…, its test d88f4686…, alert 985f698d…, alert test 20ff1db9…, parent a30eba6c… (= HEAD).
No Git writes, no GIT_DIR, synthetic fixtures only. No production, provider or DB calls. No pushes. Q3 (weekly IR lock) was left out of scope as instructed.

## Rules implemented
1. **DTD in IR+ note.** New `dtdReserves(snapshot)` in `healthyReserves.ts` returns rostered players who meet all of these:
   - in IR+;
   - Yahoo injury status `DTD`;
   - read from a live, complete Yahoo roster;
   - their team has a game today (the `asOf` local date) with status `scheduled`.

   The alert renders each as `<p role="note">`: "{name}: DTD in IR+ — may play; consider activating if you have a spot." The note sits outside the `role="alert"` warning section and uses the existing secondary-text class, so it is never a warning. There is no note on days his team doesn't play.
2. **Ranked competition.** `healthyReserves()` no longer gives open spots in roster order. It ranks flagged players by projected gain (points, then active games; unknown gains last). In that order, each player gets:
   - an open spot, while any remain;
   - otherwise the best swap partner nobody else has taken;
   - otherwise null (needs a drop).

   The output is in rank order. When some flagged players can't be activated and others can, the alert adds "Only one can be activated: best is X (+N pts)." For k > 1 it reads "Only k can be activated: best are X (+N pts) and Y …". Active games are used when points are unknown, and nothing is shown in brackets when both are unknown. Unknown-gain players keep their existing gain wording.

Parent seam (needed, because the alert has no snapshot): `RosterScheduleOptimizer.tsx` gets one prop, `dtd={snapshot ? dtdReserves(snapshot) : []}`, plus the import.

## Changed paths (final sha256)
| Path | sha256 |
|---|---|
| web/lib/rosterScheduleOptimizer/healthyReserves.ts | d24e232ee0d21a2a99b7c9c345b42e7f3561ad63ff562fccbe557caf14d9fbc8 |
| web/lib/rosterScheduleOptimizer/healthyReserves.test.ts | 9e4701a27e0f32c596c6295a4e4d8d2dcb11fb7663ee619f531678997f090cf5 |
| web/components/RosterScheduleOptimizer/HealthyReserveAlert.tsx | 4192db6cb732497119b341261a23c63cafc9936251e8c8bf13a99ff6316e830d |
| web/components/RosterScheduleOptimizer/HealthyReserveAlert.test.tsx | 4e329483710632b31ea844c4965421e142a35a63fb1153ca5c1b7aaf44767d94 |
| web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx | cc1314372e277473a0e960e811144f0aa6367b64341392e9bf8fb791ab2f0935 |

Patch vs HEAD: `hir-2.patch` (sha256 2c21583f4909b4e5f91d7cd7f3822b15d1dd0ca9065def254592fb17baba498c), 5 files, +148/−25.
Not mine: `web/next-env.d.ts` (`.next` → `.next-playwright` routes reference). It was modified at 16:29Z, before this ticket, by another lane's isolated Playwright dev server. Leave it out of this commit.

## Regression tests (one or more per rule)
- Rule 2, helper: "gives the open spot to the bigger gain, not roster order" (f +10 beats d +6; once f's forecasts are removed, f ranks last as unknown). Also "gives a shared swap partner to the bigger gain only".
- Rule 2, alert: "says only the best can be activated…": k=1 and k=2 labels; unknown gain keeps its wording; no label when everyone or nobody can be activated.
- Rule 1, helper: "notes a DTD player in IR+ only when his team plays today". Covers: no game today; O and IR statuses; DTD in IR (not IR+); manual provider; and healthyReserves stays empty for him.
- Rule 1, alert: "adds a soft note, never a warning…": role note, not inside the alert; renders with or without healthy reserves; nothing when empty.
- Original failures: the 5 new tests fail against the HEAD helper and alert, and the 11 existing tests pass (`receipt2-baseline-failures.txt`, sha256 a4501bf5…).

## Checks (all run locally under `/private/tmp/fhfh-heavy.lock`: mkdir, OWNER file, waited and never stolen, released)
- Vitest: healthyReserves (12), alert (4), lineupGaps (10), parent `RosterScheduleOptimizer.points.test.tsx` (13). **39/39 passed.**
- Scoped tsc (5 files plus ambient d.ts; temporary config removed): **exit 0**. The first run caught a real TS2345, the widened `entry.position` in the extracted `activate`, which I fixed with the `Reserved` type before the passing rerun.
- Whole-project `npm run typecheck` (the repo script, 8 GB heap): **exit 0, 0 errors**. Plain `npx tsc --noEmit` hit an out-of-memory error at Node's default heap, which is environmental; the repo script is the supported entry point.
- eslint on the 5 files: **exit 0, 0 errors.** The 6 warnings are older `react-hooks/exhaustive-deps` warnings in the parent (lines 297–667), none on changed lines.
- No browser or E2E run. The parent `dtd` prop is verified by tsc and the alert tests, not by a rendered parent test.

## Notes for review
- "That day" = the snapshot's `asOf` local date. A game that is already live or final today gives no note (status must be `scheduled`).
- Only Yahoo status `DTD` is matched (not `GTD`), per TJ's wording.
- Ranking uses each player's standalone best activation (open-spot gain if any spot is open, else best-swap gain). A player who falls back to a swap is re-priced on that swap.
