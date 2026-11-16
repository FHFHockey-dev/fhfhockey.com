# Handoff to the GAMEPRED-3 owner: AFULL-GAME3-02 (lines_ccc goalie_1 read as a confirmed starter)

**Finding:** `astra-full-audit-20261114/batch-lib-gamepred-3.md`, AFULL-GAME3-02 (P1).
- `buildGoalieBlendFeatures` in `web/lib/game-predictions/featureBuilder.ts` (about lines 1347–1385) takes any accepted,
  observed `lines_ccc` row with `goalie_1` as `confirmed: true`, `topGoalieStartProbability: 1`, `probabilityMass: 1`,
  even when `goalie_2` is also set.
- The loader (about lines 2960–2968) selects no per-goalie state, so it can't tell a confirmed starter from a listed,
  projected or unresolved one.

**What this lane did** (commit `010770ee7`, octoberBranch, not pushed). This is not a fix of the reader.
- The new pipe-goalie parse (`Husso | Dostál`, commit `4919d29a4`) would have made the first-written goalie `goalie_1`,
  and therefore a 100% starter. The order flipped the starter.
- Pipe pairs are now tagged `listing: "pipe_pair"`, and the Lines serializer (`buildRowGoalies` in
  `linesCccIngestion.ts`) skips them. With interpretation on, both orders leave `goalie_1`/`goalie_2` empty, as before
  the pipe fix.
- Regressions: `web/lib/sources/linesCccIngestion.test.ts`, "pipe goalie pairs stay out of shared Lines goalie fields".
  They run the real serializer and `buildGoalieBlendFeatures`, including a confirmed-starter control.

**Still open for the owner:** the reader bug. Other serializer paths still fill `goalie_1` from non-confirmed states:
- two listed goalie slots (`G: A` / `G: B`, or lone goalie lines) map to starter/backup with state `listed`;
- projected or likely events.

The producer keeps per-goalie states in `metadata.goalieStates` (`state`, `role`, `source`), and the reader ignores them.
The audit's suggested fix: read and apply qualified per-goalie certainty and role, and test the projected, listed,
backup, unresolved, ruled-out and confirmed cases.

**Constraints from TJ (2026-11-16):** don't replay old posts. This lane does not take over `featureBuilder.ts`.
