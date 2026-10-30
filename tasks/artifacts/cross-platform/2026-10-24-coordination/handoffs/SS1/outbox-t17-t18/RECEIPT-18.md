# SS1 ticket 18 receipt: hot and cold streak badges on the Pickups, Specialists and Tier List cards

**Workspace and delivery**
- **Freeze rule (CODEX-20261025-083):** nothing was written inside `/Users/tim/Code/fhfhockey.com` for this ticket.
  - Built in the snapshot `/private/tmp/fhfh-ss1-t18/web`, which is the ticket-17 snapshot plus this ticket.
  - Everything is delivered here in `/private/tmp/fhfh-claude-outbox/SS1/`.
- **Ordering:** ticket 17 had **not landed** canonically when this started (HEAD `1ee5127dc` doesn't contain SS1-17). So ticket 18 is a layered delta that applies after 17.
- **Patches:**
  - **`SS1-18.patch`** `b2f75cdefb78d19d935c12b93d5c69327cc4c6403d3d130d9703838dfe52b00c`: the delta against HEAD + `SS1-17.patch`. 10 files (2 new), +265/−16. Verified: HEAD + 17 + 18 equals the snapshot, 10/10.
  - **`SS1-17+18-combined.patch`** `6b37c4526b019b6333e8830cdf79024ba4280d98b1107435902813d63072c798`: one patch against HEAD `1ee5127dc`. Verified 13/13.
  - Result hashes are in `HASHES-18.txt`.
- **Repo writes before the freeze:** the freeze arrived during ticket 17's delivery. Those files were not deleted by me, and copies are in this outbox (`RECEIPT-17.md`, `SS1-17.patch`, `HASHES-17.txt`, `BASE-17.txt`, `t17/`).
  - `tasks/artifacts/cross-platform/2026-10-24-coordination/handoffs/SS1/RECEIPT-17.md`, `SS1-17.patch`, `HASHES-17.txt`, `BASE-17.txt`. The repo cleanup has since removed these top-level files.
  - `tasks/artifacts/cross-platform/2026-10-24-coordination/handoffs/SS1/t17/` (logs, evidence PNGs, test results, `live-check.json`).
  - `tasks/diaries/2026-10-24-claude-ss1-social-share-monday.md` (a ticket-17 section was appended).
- **Fixtures only; no live request; no Git.** The isolated server ran on :3140 and was released (0 listeners at 2026-10-25T15:32:23Z).
- **Network deny:** the repo's `net-deny-log.cjs` had been removed by the cleanup, so I recreated an equivalent at `net-deny.cjs` in this folder.
  - It refuses any non-loopback TCP connection or fetch and logs it. The self-test log is `selftest.jsonl`.
  - The deny log `t18/node-network.jsonl` has 1 entry: npm's registry check.

## TJ's pop-up answers

| Question | Answer |
| --- | --- |
| TOI rise threshold (10–15%) | **15%** |
| Cold-streak criteria | **Mirrored**: points in at most 1 of 5, ≤ 0.25 P/GP, TOI down ≥ 15%, PP TOI down ≥ 35% |
| Goalies | **Goalies too**. SS1 proposed the goalie rules below; **TJ confirmed them exactly as proposed** (pop-up via the orchestrator, 2026-10-25). |

## Rules (one config: `lib/socialShare/streak.ts`, `STREAK`)

- **Hot (any one):**
  - points in **≥ 4 of the last 5 GP** (games with a point, not total points);
  - **≥ 0.85 P/GP** over L5;
  - L5 TOI **≥ +15%** vs the pre-L5 season average;
  - L5 PP TOI **≥ +35%** vs the pre-L5 average;
  - **Specialists card only**, strictly greater than: **> 2 HIT/GP, > 2 BLK/GP, > 2.5 SOG/GP, > 0.5 PPP/GP**.
- **Cold (any one), the mirrored rules:** ≤ 1 of 5 GP with a point; ≤ 0.25 P/GP; TOI ≤ −15%; PP TOI ≤ −35%.
- **Goalies (TJ confirmed; `streak.ts` line 9's comment still says "proposal". It is wording only and left as-is under the freeze, so Codex may reword it to "confirmed by TJ" during integration):**
  - hot: quality starts in ≥ 4 of 5, or L5 SV% ≥ .930;
  - cold: QS in ≤ 1 of 5, or L5 SV% ≤ .870.
- **Precedence:** hot wins when both fire.
- **Insufficient games:** fewer than 5 recent games shows **no icon**.
- **Missing data never fires:** a criterion with missing data simply doesn't fire, so missing data never produces a hot icon. Live L5 hits and blocks are null today (ticket 17 finding), so those two specialist rules can't fire live yet.
- **What 0.85 P/GP means over 5 games:** totals are whole points, so it takes 5+ points (1.0); 4 points (0.80) doesn't qualify. The comparison itself is inclusive at exactly 0.85, which is tested.
- **PP TOI baseline floor:** a pre-L5 PP TOI under 0:30/GP is too small to compare, so that rule stays off.

## Sources: real rows only, no new table or read

**Per-game points (for "4 of 5")**
- Each strength-all row of `rolling_player_game_metrics` is one game. The read already returns every row in the 21-day window.
- A game's points = the difference between consecutive rows' cumulative `goals_total_all + assists_total_all`.
- It is counted **only if the six latest rows are provably consecutive games** (season GP steps by exactly 1) and the totals are present. Otherwise it is null: never guessed, and the rule doesn't fire.

**Column caught by tsc (would have broken production)**
- My first version used `points_total_all`. Full `tsc` flagged it as absent from the generated types.
- It is in `rollingDroppedColumns.ts`: the 2026-10-21 migration `drop_unread_rolling_columns` dropped it.
- Selecting it would have made the whole skater read fail live. I switched to the kept `goals_total_all` and `assists_total_all`.
- Every other selected column is checked against the drop list and kept: `toi_seconds_total_last5`, `pp_toi_seconds_total_last5`, `pp_toi_seconds_avg_season`, and the ticket-15/17 columns.

**Pre-L5 baselines exclude the L5 games**
- Pre-L5 average = (season average × season GP − L5 total) ÷ (GP − 5), for TOI and PP TOI. It needs at least 3 pre-L5 games.
- **Assumption:** `*_avg_season` on the latest row is the season-to-date mean through that game. If TJ or Codex know otherwise, the baseline needs that adjustment.

**Read size:** unchanged rows, 4 more columns on the existing bounded read.

## Card

- **Badge:** a neon badge with an inline SVG flame (hot, `$color-orange`) or snowflake (cold, `$color-blue-300`), **HOT/COLD**, and the triggering criteria in compact codes. Codes look like `5/5 P`, `1.2 P/GP`, `TOI +18%`, `PP TOI +40%`, `2.4 HIT/GP`, `4/5 QS`, `.935 SV%`, with "+N" for more.
- **Style:** an outline in the streak colour, a translucent fill on a dark backing, and a glow, matching the ticket-15 role chips.
- **Placement:**
  - pickup and specialist tiles: directly under the L5 GP line, up to 3 codes;
  - tier rows: at the right end of the L5 chip, up to 2 codes.
- Legible at 1080px. Inspected `streaks-pickups-50.png` and `streaks-tiers-wide.png`.
- Alt text names each streak and its reasons.

## Tests

- **`streak.test.ts` (9): every boundary.**
  - exactly 4/5 hot vs 3/5 not; unknown per-game points don't fire;
  - 5 pts (1.0) hot vs 4 pts (0.80) not, and the inclusive 0.85 comparison;
  - TOI +15% hot vs +14.9% not, plus a missing baseline;
  - PP TOI +35% vs +34.9%, and the baseline floor;
  - specialist rates: 2.0 not vs 2.01 hot; blocks 2.0/2.2; SOG 2.5/2.6; PPP 0.5/0.6; specialists card only; null L5 hits/blocks never fire;
  - cold mirrors: 1/5, 0.2 P/GP, TOI −15% vs −14.9%, PP −35%; hot beats cold;
  - fewer than 5 games gives nothing;
  - goalie rules at their boundaries.
- **`players.test.ts` (+1):**
  - per-game points from consecutive cumulative rows give 4 of 5;
  - a GP gap or fewer than 6 rows gives null;
  - pre-L5 TOI (800 s) and PP TOI (90 s) arithmetic;
  - too few pre-L5 games gives no baseline.
- **Vitest** `lib/socialShare/` + `components/SocialShare/`: **172/172**.
- **E2E #30 (new):** on pickups ×3, specialists and both tier cards, every tile or row badge (`data-streak`, `data-reasons`) equals `streakOf()` for that player and card. Both hot and cold occur in the fixture, geometry stays inside the square, and 3 PNGs are exported. **30/30** overall.
- **Fixture:** six consecutive fictional game rows per skater with cumulative goals and assists, and fictional TOI and PP TOI totals. Each latest row's values are unchanged from ticket 17.

## Pinned PNGs (22 asserted; run A = run B = the final pinned run, and re-confirmed after the column fix)

- **Changed (12):** Monday and Wednesday pickups ×3, specialists, tiers and tiers-wide, from the streak badges. E.g. Monday pickups-50 `c6cba7af…`, tiers-wide `dcdc79f3…`.
- **Unchanged (10):** grid, easiest and stream on Monday and Wednesday; Tuesday ×4.
- The values are in `t18/pinned-env.txt` and `t18/evidence/*.sha256`. Badge PNGs: `t18/probe/streaks-{pickups-50,specialists,tiers-wide}.png`.

## Checks

- Vitest 172/172. E2E 30/30 with 22 pins. CSS pure check OK. ESLint exit 0.
- **Full tsc** (8 GB heap, shared heavy lock, after waiting for a WIGO browser capture to release it): **exit 0** (`t18/tsc.log`).
  - Earlier full runs caught the dropped `points_total_all` and three older test rows missing the new columns. Both are fixed.
  - The last fix was test-only, after the e2e run: Vitest was rerun at 172/172, and the patches were rebuilt and re-verified.
- **Not run:** any live request, build or deploy.

## Open for TJ

- Live L5 hits and blocks are null, so those specialist triggers are dormant until the pipeline fills them.
- The `*_avg_season` semantics assumption for the TOI baselines.
