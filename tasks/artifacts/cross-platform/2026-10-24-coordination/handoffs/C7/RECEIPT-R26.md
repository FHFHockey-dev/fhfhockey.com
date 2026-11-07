# C7 ticket 26 — review of `5ba2117d5` (SS1-23: closes my R24 S1/S2)

**Verdict: accept.**

**Reviewer:** Claude C7 lane session (not the author). Read-only: no `web/` edits, no Git mutations, no `GIT_DIR`, no live reads.
- I didn't run `tsc`, as instructed; the orchestrator's gate runs it under the heavy lock.
- Unit tests ran under the outbound network-deny preload, against a clean `git archive HEAD` snapshot at `/private/tmp/c7-r26` (HEAD `5ba2117d5`).
- Evidence is in `r26-evidence/`.

## Tests

| Run | Result |
| --- | --- |
| **HEAD** (`lib/socialShare/**` + `components/SocialShare/**`) | **193/193** (matches SS1's 193) |
| **Parent mirror**: `targets.ts` and `SocialShare.tsx` reverted to `5ba2117d5^`, HEAD tests kept | **191/193**. Exactly the 2 new tests fail: "labels one tilt by its role and several by short words…" and "never picks a player rostered 50% or more, even if a source passes one" |

The Playwright change (legend-width assertion plus the three-tilt fixture) wasn't run by me (no server). SS1 reports e2e 30/30 in runs A and B and the final pinned run (`RECEIPT-23.md:31`). I viewed its PNG (below). I didn't confirm that the e2e assertion fails on the parent's longer legend.

## S2: ownership < 50 enforced in code (`web/lib/socialShare/targets.ts`)

- **Constant:** `MAX_TARGET_OWNERSHIP = 50`.
- **The filter is applied in all three paths:**
  - the server ranking-pool candidates (`targetCandidates`);
  - the client's use of **server-recorded** picks (`player.ownership < MAX_TARGET_OWNERSHIP && value !== null`);
  - the local pick computation.
- **Boundaries** (unit test):
  - exactly **50%** is excluded;
  - **87.5%** is excluded;
  - **49.9%** is picked;
  - `targetCandidates` returns `[]` when only ≥ 50% players exist;
  - every pick satisfies `ownership < 50`.
- **Fail-closed:** a `NaN` or missing ownership makes `< 50` false, so the player is excluded.
- The card's "Picks = rostered <50% (Yahoo)" now holds even if a source widens the layer.

## S1: legend fits its fieldset (`web/e2e/social-share.spec.ts`, `targets.ts` `roleLabel`, `SocialShare.tsx`)

- **Assertion:** `legendFits = legend.offsetWidth <= fieldset.clientWidth − paddingLeft − paddingRight + 0.5`. That compares the legend's **layout** width with the fieldset's inner width, so a legend wider than its card now fails. That is the gap I flagged: a shrink-wrapped legend always passes `scrollWidth ≤ clientWidth`. It's combined with the existing `inside` and `unclipped` checks for every card.
- **Three-tilt fixture:** the new `widestLegend` controller flag rewrites the first night's first **server-recorded** pick to `roles: ["scorer","shooter","blocker"]`. The test asserts exactly one `[data-roles='scorer|shooter|blocker']` card, reruns all card checks, and exports `targeted-widest-legend.png`. It exercises the real render path, because the card shows recorded roles verbatim.
- **Label:** `roleLabel` uses the full role name for one tilt ("Scorer") and short words joined with " · " for several ("Shot · Score", "Score · Shot · Block"), shown uppercase by CSS. The card and the e2e share the same function, so the expected text can't drift.
- **Viewed `t23/evidence/targeted-widest-legend.png`:** STL's first mini-card shows "SCORE · SHOT · BLOCK" notched in the top border, well inside the card width. "SHOT · SCORE" and "SCORE · SHOT" (DET, BUF) also fit.

## Observations (info, no action needed)

- The widest-legend fixture overrides roles on a recorded pick without re-deriving its stat, so it shows the first role's stat (G/GP). That is fine for a layout test.
- Any future fourth tilt (e.g. a hits tilt once a team-hits source exists) adds another " · Word". The new width assertion will catch it if it no longer fits.
