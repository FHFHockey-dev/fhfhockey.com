# SS1 ticket 21 receipt: role chips and streak badges stay legible on light team bands

- Lane: SS1, canonical checkout. Base: ticket 20 committed as `ef524ca2a`. Offline fixtures only, no live reads, no Git, no commit. Isolated :3110, released at 2026-10-25T18:34:53Z.

## Choosing the defect

**Paged reads (the orchestrator's first candidate): no remaining bug.**
- Every `bounded()` read (Yahoo, skater and goalie totals, id map, L5 recent) already has the ticket-20 fix.
- The only other paged read, `teamRates.ts`, uses page size = row limit = 64. A full page ends the loop, so it never asks for a page past the end.

**L5 hits and blocks null (second candidate): not fixable offline in this lane.**
- The rolling pipeline writes `hits_avg_last5` / `blocks_avg_last5` only when its sources (NST counts, then WGO `hits` / `blocks`) supply values for that game. See `fetchRollingPlayerAverages.ts`, simple-metric windows, and `rollingMetricSourceUnitContract.ts`.
- The `hits_total_last5` / `blocks_total_last5` columns were dropped on 2026-10-21.
- So the nulls are a source-data gap, not SS1 code. The cards already fall back honestly ("SEASON" label, "—" in the L5 line).

**Chosen: C7's open contrast finding.**
- The role chips and streak badges had a **translucent** dark backing (`rgba(#0b0d10, 0.62)` / `0.6`). On light team bands, such as TOR's white tier row, the backing turned mid-grey and the L4 and PP chips washed out.

## Fix (`web/components/SocialShare/SocialShare.module.scss`)

- The backing of `.roleChips i[data-tone=…]` (green, yellow, orange, red) and `.streak[data-streak=hot|cold]` is now an **opaque `#101317`** under the same translucent tone tint.
- Contrast no longer depends on the team band behind it. Colours, outline, glow and sizes are unchanged.

## Test (`web/components/SocialShare/SocialShare.chipContrast.test.ts`, new)

- Compiles the **real** SCSS with Sass and finds every role-chip tone and streak rule.
- For each, it asserts:
  - an **opaque hex backing** (never rgba or transparent);
  - text vs the composited chip background at **≥ 4.5:1** (WCAG AA for small text).
- It also asserts all six tones are covered (green, yellow, orange, red, hot, cold).
- **Negative control:** before the fix, all 6 tone cases failed on the translucent backing (`rgba(11, 13, 16, 0.62)`). After it, 7/7 pass.
- **Visual check:** in the Monday tiers-wide PNG, TOR's L4 and PP2 chips are dark and legible where they were washed-out grey (crops compared before and after).

## Files (sha256)

| File | sha256 |
| --- | --- |
| web/components/SocialShare/SocialShare.module.scss (M) | 2d4b2f0896d0811ae8f1ce56bd9836f87b141842214a1b645a4f48c290ded8bf |
| web/components/SocialShare/SocialShare.chipContrast.test.ts (A) | e0479401de72d718caf1ea9c59c3803be6a401f8b58b8c0fa09f147afeaa9f52 |

## Checks

- **Vitest** `lib/socialShare/` + `components/SocialShare/`: **183/183** (`t21/vitest.log`).
- **CSS pure check:** PURE OK. **ESLint** on the new test: exit 0.
- **Scoped tsc:** no social-share errors.
- **E2E behind the real gate** (fictional `.invalid` editor, deny preload, isolated :3110): **30/30** in run A, run B and the final pinned run.
  - The node deny log has 0 entries besides npm's registry check.
  - Logs and evidence are in `handoffs/SS1/t21/`.
- **PNG pins (22 asserted, identical across runs):**
  - **12 changed:** Monday and Wednesday pickups ×3, specialists, tiers and tiers-wide, from the chip and badge backing only. E.g. Monday tiers-wide `d57a9a1b…`, pickups-50 `e381d7d1…`.
  - **10 unchanged:** grid, easiest and stream on Monday and Wednesday; Tuesday ×4.
  - The new values are in `t21/pinned-env.txt`.

## Left open

- **The tier-row L5 box (`.tierRecent`)** still uses a translucent backing (`rgba(#0b0d10, 0.55)`). On white bands it reads grey with white text, borderline about 4:1. The same one-line opaque fix and a test would close it, but it's out of this time box.
- **Unchanged:** the ticket-17 server-log root cause, the null live L5 hits and blocks (source data), TJ's "relative TOI" meaning, and the access-gate boundary request.
