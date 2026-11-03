# C7 ticket 20 — review of two local commits that skipped review

**Reviewer:** Claude C7 lane session (not the author). Read-only: no edits to `web/`, no Git mutations, no `GIT_DIR`, no live reads. Tests ran under the outbound network-deny preload. Evidence is in `r20-evidence/`.

| Commit | Verdict |
| --- | --- |
| `63654c308` TG run-store contract kit | **Accept** (one nit) |
| `48809914a` HIR DTD note and ranked competing activations | **Accept with limits.** It meets both of TJ's rules as tested; one greedy-assignment edge can understate "Only k" (H1). |

## Tests

- **Current tree: 170/170** (`now.json`).
  - **TG: 154 in 9 files**, including `runStoreContract.test.ts` 8. That matches the commit's 154.
  - **HIR: 16**, with `healthyReserves` 12 and `HealthyReserveAlert` 4.
- **New HIR tests against the old code** (`old.json`): I mirrored the RSO directories and their sibling imports in scratch, with `healthyReserves.ts` and `HealthyReserveAlert.tsx` restored to `48809914a^`.
  - **All 5 new tests fail**: "gives the open spot to the bigger gain…", "gives a shared swap partner to the bigger gain only", "notes a DTD player in IR+ only when his team plays today", "says only the best can be activated…", and "adds a soft note, never a warning…".
  - **All 11 older tests still pass.**
  - So the new tests do guard the new behaviour. Run 1 (`old-run1.*`) failed to load because my mirror lacked sibling directories; that was a reviewer error.

## `48809914a` HIR: findings

**What holds, against TJ's rules:**
- **(1) DTD note.** `dtdReserves` (`web/lib/rosterScheduleOptimizer/healthyReserves.ts:31-42`) returns only `IR+` entries whose player has `injury.status === "DTD"` and whose team has a game today with `status === "scheduled"`. It needs a live, complete Yahoo read.
  - The alert renders it as a separate `role="note"` paragraph, not inside the `role="alert"` section (`HealthyReserveAlert.tsx`, the `dtd.map`).
  - It shows even when no healthy reserve is flagged.
  - **Edge, no game today:** no note (tested).
  - **Edge, today's game already live or final:** also no note. That fits "consider activating", since the slot can't change after puck drop, but it is narrower than "days his team plays".
- **(2) Ranking.**
  - Gains are sorted by `byGain` (projected points, then active games), and `descending` puts `null` last (`healthyReserves.ts:21`).
  - Players without any activation sort after every player with one.
  - Open spots go to the top-ranked players first, and later players get the best swap partner not already `taken`.
  - `contestText` prints "Only k can be activated: best is/are …" only when some, but not all, flagged players get an activation (`HealthyReserveAlert.tsx`, `contestText`).
  - **Edge, 0 spots:** ranking uses each player's best swap; a shared partner goes to the bigger gain (tested). With no partner at all, nobody is activated and no "Only 0" text appears; each row keeps its drop message.
  - **Edge, null gain:** ranked last (tested: with `f`'s forecasts removed, `d` takes the spot).

**Limits:**

| # | Item |
| --- | --- |
| **H1** (medium-low) | **The greedy assignment can understate "Only k can be activated".** When open spots exist, every player is ranked by **direct-activation** gain (`healthyReserves.ts`, `ranked`, `openSpots > 0 ? activate(entry, null) : …`). Spots go to the top of that list, and only the leftover players try swaps. Counter-case by code path: A gains 10 from the spot or 9 via a swap partner; B gains 8 from the spot and has no eligible partner. A takes the spot and B gets `null`, so the alert says "Only one can be activated: best is A". But A-via-swap plus B-via-spot activates **both**. To fix it, try the swap for spot-takers first (e.g. give spots to players without swap options), or count "can be activated" from a maximum matching. **Not covered by a test.** |
| **H2** (low) | **Ties** in projected gain and active games keep `healthy` roster order (stable sort). That is deterministic but undocumented, and no test covers it. |
| **H3** (info) | In the contest text, an activated player whose gain is unknown appears in the "best are …" list without a number (e.g. "… and Third Man"). That matches the test, but calling an unknown-gain player "best" reads oddly. "Can be activated: A (+10 pts) and Third Man" would avoid implying a ranking. |

## `63654c308` TG contract kit

**What holds:**
- `describeRunStoreContract` exercises only the `ExperimentRunStore` interface, with 8 behaviours:
  - idempotent per-owner accept with conflict and invalid-plan refusals;
  - owner scoping of every operation **and** `list`;
  - newest-first listing capped at `MAX_LISTED_RUNS` and strictly parsed;
  - lease fencing and exactly-once outputs;
  - pending outcomes kept out of completed coverage;
  - sealed results until the planned synthetic reveal;
  - no reveal for non-synthetic history;
  - cancel at checkpoint with late work rejected.
- It is registered once, against the memory store, in `runStoreContract.test.ts`.
- **Scope:** the commit has 2 files (+149). Nothing else imports the kit, and there are no route, UI or DB changes.
- **Partly closes my TG-S06 L2:** the owner-scoped `list` is now part of the contract every store must pass.

**Nits:**

| # | Item |
| --- | --- |
| **T1** (nit) | `web/lib/forge-testing-grounds/runStoreContract.ts:1` imports `vitest` from a non-`*.test` module under `lib/`. It is only imported by its test today, but an accidental production import would pull Vitest into a bundle. Consider `runStoreContract.testkit.ts` or moving it under `__tests__/`, plus a lint rule. |
| **T2** (info) | My TG-S06 L1 (revealed results aren't bound to a run or plan) isn't in the contract yet. Adding "results for run A never return run B's outputs" would make every durable adapter prove it. |
