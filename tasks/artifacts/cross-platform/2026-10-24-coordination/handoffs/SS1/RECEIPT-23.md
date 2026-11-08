# SS1 ticket 23 receipt: C7 R24 limits S1 (legend width) and S2 (self-enforcing <50%)

- Lane: SS1, canonical checkout. Base: `cc4886a81` (tickets 21–22 committed; the tree was clean at start). Offline fixtures only, no live reads, no Git, no commit.
- Isolated :3110, released at 2026-10-25T19:24:25Z. The Node deny log has 0 entries besides npm's registry check.

## S1: a legend wider than its fieldset is now caught, and the widest one fits

**E2E check (`e2e/social-share.spec.ts`)**
- Each mini-card's `legend.offsetWidth` must be ≤ the fieldset's inner width (`clientWidth` minus its horizontal padding). Layout widths are used, so the preview scale can't hide an overflow.
- This sits alongside the existing inside-the-card and not-clipped checks, for every card on the normal, long-name and live-trimmed editions.

**Widest-legend fixture**
- A new `widestLegend` controller flag, on the live-trimmed edition, records the first night's first pick with **all three tilts** (scorer, shooter, blocker). The card shows recorded roles verbatim, so this renders the widest real legend.
- The test asserts exactly one `data-roles='scorer|shooter|blocker'` card, re-runs all the card checks, and exports `targeted-widest-legend.png`.

**Negative control:** with the old label "SCORER + SHOOTER + BLOCKER", the new width check **failed**, so the legend really overflowed.

**Fix (`lib/socialShare/targets.ts`, `roleLabel`)**
- A single tilt keeps its role word: "SCORER", "SHOOTER", "BLOCKER".
- Several tilts use short words joined by " · ": **"SCORE · SHOT"**, **"SCORE · SHOT · BLOCK"**. This is the orchestrator's suggested option, which needs no layout change.
- The card and the e2e use the same `roleLabel`. The PNG crop shows "SCORE · SHOT · BLOCK" notched in the top border with room to spare.

## S2: under 50% rostered is enforced in the pick logic, not only by the source read

- `MAX_TARGET_OWNERSHIP = 50`. `targetCandidates`, `targetPicks` and the recorded live-edition path all require `player.ownership < 50`.
- **Test:** a 50% "star" and an 87.5% player who'd top every tilt are never picked, with all three tilts active. The server pool drops them. A 49.9% player is still picked.

## Tests and checks

- **Vitest** `lib/socialShare/` + `components/SocialShare/`: **193/193**. `targets.test.ts` is now 10: +S2, plus the label rules (`Scorer`, `Shot · Score`, `Score · Shot · Block`).
- **E2E behind the real gate** (fictional `.invalid` editor, deny preload): **30/30** in run A, run B and the final pinned run.
- **CSS pure check:** PURE OK (no SCSS change this ticket). **ESLint** on the social lib, components and spec: exit 0. **Scoped tsc:** no social-share errors.
- **PNG pins (22 asserted, identical across runs):**
  - **2 changed:** Monday stream `1cb1c5d8…` and Wednesday stream `60d841a5…`. The only visible change is that the fixture's dual-role pick reads "SHOT · SCORE" instead of "SHOOTER + SCORER".
  - **20 unchanged.** Values are in `t23/pinned-env.txt`.
- **Evidence:** `handoffs/SS1/t23/` (runs A and B, evidence, `probe/targeted-widest-legend.png`, logs).

## Files and sha256 (also in `HASHES-23.txt`)

```
f549636e87344f8fa9fdf423bcd3278adbe143a227a7302424979f0d5de3e95e  web/components/SocialShare/SocialShare.tsx
62abeaeb8b48cc62f3de5ac9878cfb1573ffc9bf14664273735022950e406296  web/e2e/social-share.spec.ts
f0f11652f9d90a2564a2d6c1fd9ebb83316f3e91db76cf10c96533a0af06d53d  web/lib/socialShare/targets.test.ts
b5e85a0d26555a5ad821b4bd94abb377fbf02d96feda685c0f332b83f99c2e2f  web/lib/socialShare/targets.ts
```
