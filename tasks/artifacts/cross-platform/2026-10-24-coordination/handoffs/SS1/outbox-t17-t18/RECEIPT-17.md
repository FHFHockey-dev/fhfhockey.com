# SS1 ticket 17 receipt: "Recent form unavailable" on every pickup, plus the meta-caption removal

**Workspace and delivery**
- **Workspace:** a fresh snapshot of canonical HEAD `1ee5127dc`, `git archive` → `/private/tmp/fhfh-ss1-t17/web`, with `node_modules` symlinked.
  - The tracked `.env.*` files that came with the archive were **deleted unread**.
  - The snapshot server got fictional `NEXT_PUBLIC_SUPABASE_URL` / `_PUBLIC_KEY` / `CMS_URL` values.
  - **No canonical file was edited.**
- **Patch for Codex:** **`SS1-17.patch`** `095cecb4dce6b0d06421114a47e6e6b40a79b7715253c7a68b18939dcde382e3`, against canonical HEAD bytes. Base hashes are in `BASE-17.txt`, result hashes in `HASHES-17.txt`.
  - 9 files, +132/−33.
  - Verified: HEAD + patch equals the snapshot, 9/9. The canonical working tree equals HEAD for all 9.
- **Read-only, untouched:** AuthProviderContext, access.ts, SocialShareAccessGate, and the page and API auth lines.
- **No Git.** The isolated server ran on **:3140** (:3125 untouched) and was **released**: 0 listeners at 2026-10-25T15:06:19Z.

## 1. Diagnosis

**From code (no live reads):** the shipped read path is the same in release #380 (`b3f9a7e25`) and HEAD.
- `server.ts` attaches recent form only through `loadSharePlayerRecent(...).catch(() => null)`. A `null` makes `recentState: "unavailable"`, which is exactly "Recent form unavailable" on every tile. So in production the recent load **rejected**.
- **Blast radius:** the skater (`rolling_player_game_metrics`) and goalie (`wgo_goalie_stats`) reads ran in **one `Promise.all`** under fail-closed `bounded()` checks. Either one failing blanked everyone, and the reason was swallowed: there was no log.
- **Ruled out in code:**
  - **Row grain:** rolling PK is `(player_id, game_date, strength_state)`, read for strength `all`; goalie PK is `(goalie_id, date)`. So there is at most one row per player per date and no duplicate per date.
  - **Season types:** `season` and `season_id` are integers; 20262027 is correct.
  - **Anon access:** both tables have `GRANT SELECT … TO anon` and a `public_read` RLS policy.
  - **Columns:** all 17 rolling and 10 goalie selected columns exist in the schema baseline, none dropped.
  - **Ids:** pool ids are validated safe integers.
  - **Indexes:** the query shape is covered by `idx_rpgm_latest_snapshot_lookup` and the PKs.
  - **Paging:** pages are capped at 1,000 with an exact count.

**Bounded live check (TJ approved by pop-up):** 3 sequential read-only selects, anon key, one attempt each, no writes. Results are in `t17/live-check.json` (codes, counts and timing only).

| Read | Result |
| --- | --- |
| 1. rolling, 17 card columns, season 20262027, strength all, since 2026-10-04, 5 rows | **OK**, 233 ms, count **5,093**, all columns present |
| 2. wgo_goalie_stats, 10 columns, same window, 5 rows | **OK**, 68 ms, count **307** |
| 3. rolling window count only | **OK**, 90 ms, 5,093 |

**What this means**
- The sources, columns, anon access, season format and timing are all fine. The data is about 7 rows per skater over 22 days, well under the cap.
- **The production failure did not reproduce** with the exact columns and filters. The parts not exercised are the production-only pieces: the pool's ~130-id `in()` list, the multi-page exact-count path, and the Vercel runtime.
- I did not ask for more reads beyond the approved 3.
- **Next evidence:** the fix below logs the reason server-side (`[social-share] Skater|Goalie recent games unavailable: <code> <message>`, with no ids or values). One read-only look at Vercel runtime logs after Codex deploys will name the cause.
- **Data finding:** `hits_avg_last5` and `blocks_avg_last5` were **null in all 5 sampled live rows**. Until the rolling pipeline fills them, the hits and blocks specialist lists fall back to season per-GP (labelled "SEASON"), and the L5 line shows "—" for those stats.

## 2. Fix (fail-closed, honest states, never fabricated L5)

- **Isolated sources** (`playerSources.ts`): `Promise.allSettled`. Each source fails on its own to `null`, with the reason logged. Goalie trouble can no longer blank skaters, or the reverse.
- **Limits from the true grain:** `RECENT_LIMITS.{skater,goalie}RowsPerPlayer = lookbackDays + 1` (22). At most one row per player per date over a 21-day lookback (22 dates inclusive), so the cap can't trip on legitimate data. An over-limit read still fails closed.
- **Honest states** (`players.ts`, `types.ts`): `recentState` is now `"ready" | "partial" | "unavailable"`, plus `recentUnavailable: ["skaters" | "goalies"]`.
  - Only the failed source's tiles say "Recent form unavailable".
  - "No game in the last two weeks" appears only when that player's source answered.
- **Cache:** `shareCacheControl` treats "partial" as unready (60 s ceiling). Codex's route currently sends private no-store anyway.
- **Unchanged:** server-side trim, exposure caps, no writes, no new tables or reads.

## 3. Meta captions removed (TJ: "Most signals first · one night per team" doesn't need to be included)

**Removed:**

| Card | Removed string |
| --- | --- |
| Best Schedules grid footer | "Ranked by Game Grid Week Score (games, off-nights, slate density) · " |
| Streaming Matchups legend | "**Top-12** Week Score teams" |
| Streaming Matchups legend | "Most signals first · one night per team" |
| Easiest Schedules footer | " · {floor}+ games left" (e.g. "· 3+ games left") |
| Pickups eyebrow | " · top-10 schedules first" (now "{Day} · Pickups") |
| Pickups / Specialists footer | "Top-10 Week Score teams first, wider pool fills to three · " |
| Pickups footer | ", ranked by L5 score" (after the bands) |
| Specialists footer | "ranked by L5 score · " |
| Tier list legend | ", best Week Score first" (now "Tier = exact GP · off-night pair") |
| Tier list legend (widened) | "Widened: tiers 2–3 fold in the next pair" (the bar already shows both pairs) |
| Tier list legend | " · skaters, then goalies, each by L5 score" (now "Under 50% rostered") |
| Tier list footer | "Strictly tier teams only · " |

**Kept:**
- **Source and as-of lines:** NST, Yahoo, NHL.com, schedule checked.
- **Ownership bands:** "Bands 30–49% · 20–29% · under 20%", "Under 50% rostered".
- **Limitation disclosures:** "No odds or projections", "Not projections", "Ranking unavailable · alphabetical order" on untrusted editions, "Add/drop counts are not in FHFH's sources", and the sample minimums.
- **Legends that define marks on the card:** Storm, Tired, Soft/Average/Strong, Wider pool, L5 GP, "+N more", the SCORE colour scale.
- **The score definitions:** TJ's printed formula (ticket 15), "Score uses games, off-nights and slate density" on the leaders card, and the OPP DEF definition.
- **Not visible on the card:** alt text (`aria-label`) still describes the ordering for screen readers.
- **Tuesday legends:** unchanged. They define comparison windows, not ordering.

## Tests

- **Vitest** `lib/socialShare/` + `components/SocialShare/`: **162/162** (`t17/vitest.log`).
  - **Reproduction:** a live-shaped mock with one strength-all row per date over the full 22-day window. A goalie PostgREST error (`57014` statement timeout) used to reject the whole load. Now skater rows come back and goalies are `null`. The reverse case (`42703` missing column on the rolling read) leaves goalies answering. Both reasons are logged.
  - **Over-limit:** only the skater source fails, with its reason logged; goalies are unaffected.
  - **Grain:** caps are `lookbackDays + 1`.
  - **`attachRecent` partial:** a failed goalie source marks only goalies.
  - **Server (real handler, mocked sources):** goalies failed → `recentState: "partial"`, `recentUnavailable: ["goalies"]`; every skater keeps its recent form and every goalie has none.
- **E2E** `e2e/social-share.spec.ts`: **29/29**.
  - **#24 extended:** with only the goalie source failed, the 6 skater tiles show L5 lines and only the 3 goalie tiles say "Recent form unavailable".
  - **New #29:** across the grid, leaders, easiest, stream, pickups ×3, specialists and both tier cards, none of the removed captions appears. The bands, "Not projections", the Yahoo as-of and "No odds or projections" remain.

## Pinned PNGs (22 asserted; identical across run A, run B and the final pinned run)

- **Changed (18):** every Monday and Wednesday card, from the caption removals only. The render inputs (SCSS, TeamBanner, export, matchups, mondayGrid) are byte-identical to SS1-16. The values are in `t17/pinned-env.txt` and `t17/evidence/*.sha256`. E.g. Monday grid `49fe522d…`, stream `fa77ba01…`, pickups-50 `b5a43255…`, tiers `f8b7b15a…`.
- **Unchanged (4):** Tuesday hot, deployment, rates and movers.

## Checks run

- Vitest 162/162. Playwright (mocked) 29/29 with 22 pins, on the snapshot server :3140 under the deny preload. The Node deny log has 1 entry, npm's registry check.
- CSS pure check: PURE OK (no SCSS change). ESLint: exit 0.
- **Full `tsc --noEmit`** on the snapshot (heavy lock): **exit 0**.
  - The first run caught a `null` vs `undefined` parameter type in `recentLine`; it was fixed and re-run clean.
  - At HEAD the earlier Luna errors are gone.
- **Live:** exactly the 3 approved selects. No other live request, build or deploy.

## For Codex and TJ

- **Codex:** integrate `SS1-17.patch` (base = HEAD `1ee5127dc` bytes, see `BASE-17.txt`). After deploy, one read-only check of Vercel runtime logs for `[social-share]` names the production failure.
- **TJ:**
  - L5 hits and blocks are null live, so the specialists' hits and blocks lists use season rates for now.
  - The meta-caption list above is my reading of "this type of meta text". Say if any kept line should go too.
